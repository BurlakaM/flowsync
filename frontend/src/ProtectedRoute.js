import React from "react";
import { useEffect, useState, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import Loader from "./components/Loader";

export default function ProtectedRoute({ redirectPath = "/" }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const isChecking = useRef(false);

    useEffect(() => {
        const checkAuth = async () => {
            if (isChecking.current) return;
            isChecking.current = true;

            const accessToken = localStorage.getItem("access_token");

            if (!accessToken) {
                setIsAuthenticated(false);
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/validate-token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: accessToken }),
                });

                const data = await response.json();

                if (data.valid) {
                    setIsAuthenticated(true);
                } else {
                    localStorage.removeItem("access_token");
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Token validation failed:", error);
                localStorage.removeItem("access_token");
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    if (isLoading) { return <Loader />}

    return isAuthenticated ? <Outlet /> : <Navigate to={redirectPath} replace />;
}


