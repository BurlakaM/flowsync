import React, {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

export default function Login() {
    const navigate = useNavigate();
    useEffect(() => {if (localStorage.getItem("access_token")) navigate("/dashboard"); }, [navigate]);
    const apiUrl = process.env.REACT_APP_API_URL;
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        try {
            const response = await fetch(`${apiUrl}/auth/login`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (response.ok) {
                console.log("Login successful:", result);
                localStorage.setItem("access_token", result.access_token);
                navigate("/dashboard");
            } else {
                console.error("Login failed:", result);
                setError(result.message || "Login failed");
            }
        } catch (err) {
            console.error("Error:", err);
            setError("An unexpected error occurred");
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <h2>Login</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <div>
                <label>Email:</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <div>
                <label>Password:</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>
            <button type="submit">Login</button>
        </form>
    );
}
