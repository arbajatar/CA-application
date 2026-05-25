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

        if (!error.response) {
            // Network connection issue or CORS or server unreachable
            toast.error("Unable to connect to the server. Please check your network connection.", {
                id: 'global-network-error'
            });
        } else if (status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            // Only redirect if not already on login page to avoid loops
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login'
            }
        } else if (status === 403) {
            toast.error(error.response?.data?.message || 'You do not have permission to perform this action.');
        } else if (status === 404) {
            toast.error("Requested resource or API endpoint not found (404).");
        } else if (status >= 500) {
            toast.error("Server encountered an error. Please try again later or contact support (500).");
        }

        return Promise.reject(error)
    }
)

export default api;
