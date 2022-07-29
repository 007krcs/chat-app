import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";

import Dashboard from "./authPages/Dashboard/Dashboard";
import LoginPage from "./authPages/LoginPage/LoginPage";
import RegisterPage from "./authPages/RegisterPage/RegisterPage";
import AlertNotification from "./authPages/shared/components/AlertNotification";

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route exact path="/login" element={<LoginPage/>} />
          <Route exact path="/register" element={<RegisterPage/>} />
          <Route exact path="/dashboard" element={<Dashboard/>} />  
          <Route path="/" element={<Navigate replace to="/dashboard" />} />        
        </Routes>
      </Router>
      <AlertNotification/>
    </>
  );
}

export default App;
