export const logOut =()=>{
    localStorage.clear();
    window.location.pathname = '/login';
}