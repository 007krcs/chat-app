import axios from "axios";
import { logOut } from "./authPages/shared/utils/authLog";

const apiClient = axios.create({
    baseURL: 'http://localhost:5001',
    timeout: 1000
});

apiClient.interceptors.request.use((config)=> {
    const userDetails = localStorage.getItem("user");
    if(userDetails){
        const token = JSON.parse(userDetails).token;
        config.headers.Authorization = `${token}`
    }

    return config;
}, (err)=>{
    return Promise.reject(err);
})

export const login = async (data)=>{
    try {
        return await apiClient.post('/api/auth/login',data)
    } catch (exception) {
        return {
            error: true,
            exception
        }
    }
}

export const register = async (data)=>{
    try {
        return await apiClient.post('/api/auth/register',data)
    } catch (exception) {
        return {
            error: true,
            exception
        }
    }
}

//secure routes

const checkResponseCode = (exception) => {
    const responseCode  = exception?.response?.status;
    if(responseCode){
        (responseCode === 401 || responseCode === 403) && logOut();
    }
}