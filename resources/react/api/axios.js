import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
    baseURL: "/api",
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Global response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const { status } = error.response || {};

        if (status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            // Only redirect if not already on login page to avoid loops
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login'
            }
        }

        if (status === 403) {
            toast.error(error.response?.data?.message || 'You do not have permission to perform this action.');
        }

        return Promise.reject(error)
    }
)

export default api;
