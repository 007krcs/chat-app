Great — below is a **copy-paste ready, UI-first (Option B)** example that uses:

* **React Query** for server data (users CRUD with caching, optimistic delete, mutations),
* **Redux Toolkit** for local app state only (an example `todos` slice),
* **`createAsyncThunk`** for authentication (login) and storing token in Redux + `localStorage`,
* **Protected routes** that check auth state.

Drop these files into the same folder structure you used before (`src/...`) in a Vite React app. I kept the code minimal and practical so you can run it straight away.

---

# 0) Install (if not already)

```bash
npm create vite@latest react-query-demo -- --template react
cd react-query-demo
npm install @reduxjs/toolkit react-redux @tanstack/react-query axios react-router-dom
npm run dev
```

---

# 1) `src/main.jsx`

```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { store } from "./app/store";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </Provider>
);
```

---

# 2) `src/app/store.js`

```js
import { configureStore } from "@reduxjs/toolkit";
import todosReducer from "../features/todos/todosSlice";
import authReducer from "../features/auth/authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    todos: todosReducer, // local app state example
  },
  // default middleware includes thunk
});
```

---

# 3) `src/features/auth/authSlice.js` (createAsyncThunk login)

```js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

/**
 * loginThunk: posts credentials to /auth/login and expects { token, user }.
 * On success we store token to Redux + localStorage (simple persistence).
 */
export const loginThunk = createAsyncThunk(
  "auth/login",
  async ({ email, password }, thunkAPI) => {
    const API_URL = import.meta.env.VITE_API_URL || "/api";
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return thunkAPI.rejectWithValue(err.message || "Login failed");
    }
    const data = await res.json(); // { token, user }
    localStorage.setItem("token", data.token);
    return data;
  }
);

const initialState = {
  token: localStorage.getItem("token") || null,
  user: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem("token");
    },
    setUser(state, action) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (s) => {
        s.loading = true; s.error = null;
      })
      .addCase(loginThunk.fulfilled, (s, a) => {
        s.loading = false;
        s.token = a.payload.token;
        s.user = a.payload.user;
      })
      .addCase(loginThunk.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload || a.error.message;
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
```

---

# 4) `src/features/todos/todosSlice.js` (RTK slice — local state)

```js
import { createSlice, nanoid } from "@reduxjs/toolkit";

const todosSlice = createSlice({
  name: "todos",
  initialState: {
    items: [
      // example local item: { id: '1', title: 'Local todo', completed: false }
    ],
  },
  reducers: {
    addTodo: {
      reducer(state, action) {
        state.items.push(action.payload);
      },
      prepare(title) {
        return { payload: { id: nanoid(), title, completed: false } };
      },
    },
    toggleTodo(state, action) {
      const t = state.items.find((x) => x.id === action.payload);
      if (t) t.completed = !t.completed;
    },
    removeTodo(state, action) {
      state.items = state.items.filter((x) => x.id !== action.payload);
    },
    updateTodoTitle(state, action) {
      const { id, title } = action.payload;
      const t = state.items.find((x) => x.id === id);
      if (t) t.title = title;
    },
  },
});

export const { addTodo, toggleTodo, removeTodo, updateTodoTitle } = todosSlice.actions;
export default todosSlice.reducer;
```

---

# 5) `src/services/axios.js` (axios instance for React Query — reads token from localStorage)

```js
import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

// request interceptor: attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

> Note: reading token from `localStorage` avoids circular imports. If you store token elsewhere, adapt accordingly (e.g., read from Redux store directly in a function).

---

# 6) `src/queries/useUsers.js` — React Query hooks for Users (CRUD + optimistic delete)

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../services/axios";

/** Fetch users */
export function useUsers() {
  return useQuery(["users"], async () => {
    const { data } = await api.get("/users");
    return data;
  });
}

/** Create user */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation(
    (newUser) => api.post("/users", newUser).then((r) => r.data),
    { onSuccess: () => qc.invalidateQueries(["users"]) }
  );
}

/** Update user */
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation(
    ({ id, patch }) => api.patch(`/users/${id}`, patch).then((r) => r.data),
    { onSuccess: () => qc.invalidateQueries(["users"]) }
  );
}

/** Delete user with optimistic update */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation(
    (id) => api.delete(`/users/${id}`).then((r) => r.data),
    {
      onMutate: async (id) => {
        await qc.cancelQueries(["users"]);
        const prev = qc.getQueryData(["users"]);
        qc.setQueryData(["users"], (old = []) => old.filter((u) => u.id !== id));
        return { prev };
      },
      onError: (err, id, context) => {
        qc.setQueryData(["users"], context.prev);
      },
      onSettled: () => qc.invalidateQueries(["users"]),
    }
  );
}
```

---

# 7) `src/components/Login.jsx`

```jsx
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginThunk } from "../features/auth/authSlice";
import { useNavigate, useLocation } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, token } = useSelector((s) => s.auth);
  const from = location.state?.from?.pathname || "/";

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(loginThunk({ email, password })).unwrap();
      navigate(from, { replace: true });
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit}>
        <div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        </div>
        <div>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" />
        </div>
        <button type="submit" disabled={loading}>Login</button>
        {error && <div style={{ color: "red" }}>{error}</div>}
      </form>
    </div>
  );
}
```

---

# 8) `src/routes/ProtectedRoute.jsx`

```jsx
import React from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = useSelector((s) => s.auth.token);
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
```

---

# 9) `src/components/UsersRQ.jsx` — React Query Users component (list, create, update, delete)

```jsx
import React, { useState } from "react";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "../queries/useUsers";

export default function UsersRQ() {
  const { data: users = [], isLoading, isError, isFetching } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [name, setName] = useState("");

  const onCreate = async () => {
    if (!name.trim()) return;
    await createUser.mutateAsync({ name });
    setName("");
  };

  const onToggleCase = async (u) => {
    await updateUser.mutateAsync({ id: u.id, patch: { name: u.name === u.name.toUpperCase() ? u.name.toLowerCase() : u.name.toUpperCase() } });
  };

  const onDelete = async (id) => {
    if (!confirm("Delete user?")) return;
    try {
      await deleteUser.mutateAsync(id);
    } catch (err) {
      console.error("delete failed", err);
    }
  };

  if (isLoading) return <div>Loading users...</div>;
  if (isError) return <div>Error loading users</div>;

  return (
    <div style={{ padding: 16 }}>
      <h3>Users {isFetching && "(updating...)"}</h3>
      <div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New user name" />
        <button onClick={onCreate}>Create</button>
      </div>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.name}{" "}
            <button onClick={() => onToggleCase(u)}>ToggleCase</button>{" "}
            <button onClick={() => onDelete(u.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

# 10) `src/components/TodosRTK.jsx` — local RTK Todos UI (CRUD local)

```jsx
import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { addTodo, toggleTodo, removeTodo, updateTodoTitle } from "../features/todos/todosSlice";

export default function TodosRTK() {
  const todos = useSelector((s) => s.todos.items);
  const dispatch = useDispatch();
  const [title, setTitle] = useState("");

  const onAdd = () => {
    if (!title.trim()) return;
    dispatch(addTodo(title));
    setTitle("");
  };

  return (
    <div style={{ padding: 16 }}>
      <h3>Local Todos (RTK)</h3>
      <div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New todo" />
        <button onClick={onAdd}>Add</button>
      </div>
      <ul>
        {todos.map(t => (
          <li key={t.id}>
            <input type="checkbox" checked={t.completed} onChange={() => dispatch(toggleTodo(t.id))} />
            <input
              value={t.title}
              onChange={(e) => dispatch(updateTodoTitle({ id: t.id, title: e.target.value }))}
              style={{ marginLeft: 8 }}
            />
            <button onClick={() => dispatch(removeTodo(t.id))}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

# 11) `src/App.jsx` — routes & nav

```jsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Login from "./components/Login";
import UsersRQ from "./components/UsersRQ";
import TodosRTK from "./components/TodosRTK";
import ProtectedRoute from "./routes/ProtectedRoute";
import { useDispatch } from "react-redux";
import { logout } from "./features/auth/authSlice";

export default function App() {
  const dispatch = useDispatch();
  return (
    <div>
      <nav style={{ padding: 8, borderBottom: "1px solid #ccc" }}>
        <Link to="/">Home</Link>{" | "}
        <Link to="/users">Users (React Query)</Link>{" | "}
        <Link to="/todos">Todos (RTK)</Link>{" | "}
        <button onClick={() => dispatch(logout())}>Logout</button>
      </nav>

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <UsersRQ />
            </ProtectedRoute>
          }
        />
        <Route
          path="/todos"
          element={
            <ProtectedRoute>
              <TodosRTK />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<ProtectedRoute><div style={{ padding: 20 }}><h2>Welcome — choose a page</h2></div></ProtectedRoute>} />
      </Routes>
    </div>
  );
}
```

---

# 12) `.env` (optional)

```
VITE_API_URL=https://api.example.com
```

or keep it blank to use `/api` relative path for local proxies.

---

# How these pieces relate (flow recap)

1. **Login**

   * `Login.jsx` dispatches `loginThunk`.
   * `loginThunk` calls `/auth/login` and stores `{ token, user }` in Redux and `localStorage`.
2. **React Query Requests**

   * `services/axios.js` attaches token from `localStorage` to every request.
   * `useUsers()` uses that axios instance to `GET /users` and stores the response in React Query cache (not in Redux).
3. **CRUD**

   * Create/update/delete users are done via React Query `useMutation` hooks; after successful mutation the hooks invalidate or update the `["users"]` query so UI refreshes.
   * Delete demonstrates an optimistic update pattern (`onMutate` → rollback on error).
4. **Local UI state**

   * Todos are intentionally stored in Redux (`todosSlice`) to demonstrate local app state usage with RTK. This keeps server data (users) out of Redux and demonstrates a clear separation.
5. **Protected routes**

   * `ProtectedRoute` checks `auth.token` in Redux and redirects to `/login` if missing.

---

# Notes / Recommendations

* **Why this pattern?** Good separation: server/stateful caching handled by React Query (great UX & caching features), while Redux stores local UI state that many components read/write synchronously (e.g., persistent client-only lists, UI flags).
* **Token source:** I used `localStorage` for the axios interceptor to keep the code simple. For increased security use httpOnly cookies or keep token in Redux and implement an interceptor that reads from Redux (requires careful circular-import avoidance).
* **Refresh tokens / 401 handling:** For production, implement refresh token flow. React Query + axios interceptor can coordinate refresh logic; you can keep refresh orchestration in a thunk or saga if flows get complex.
* **Mock backend:** If you don't have a backend, use `json-server` for `/users` and `/todos` (note: `json-server` has no auth), or spin up a tiny Express mock for `/auth/login`.

---

If you want next I can:

* Generate a **minimal Express mock backend** for `/auth/login`, `/users` (CRUD) to test the full flow locally.
* Convert the example to **TypeScript**.
* Add **pagination / infinite scroll** example with React Query.
  Which would you like?
