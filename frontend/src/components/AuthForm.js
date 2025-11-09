import React, {useEffect, useState} from "react";
import Input from "./Input";
import {useNavigate} from "react-router-dom";

export default function AuthForm() {
    const [activeTab, setActiveTab] = useState("sign-in");
    const navigate = useNavigate();
    useEffect(() => {
        if (localStorage.getItem("access_token")) navigate("/dashboard");
    }, [navigate]);
    const apiUrl = process.env.REACT_APP_API_URL;
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        console.log(JSON.stringify({email, password, name, confirmPassword}));
        return;
        try {
            const response = await fetch(`${apiUrl}/auth/login`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({email, password}),
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
        <div className="auth-form-wrapper">
            <div
                  className="auth-form p-3 d-flex flex-column gap-3 justify-content-center w-40 mx-auto rounded-4 mt-5 p-4">
                {/* Tabs */}
                <div className="auth-tabs d-flex gap-3">
                    <div id="sign-in" className={`auth-tab ${activeTab === "sign-in" ? "active" : ""}`}
                         onClick={() => setActiveTab("sign-in")}>
                        Sign In
                    </div>
                    <div id="sign-up" className={`auth-tab ${activeTab === "sign-up" ? "active" : ""}`}
                         onClick={() => setActiveTab("sign-up")}>
                        Sign Up
                    </div>
                </div>
                <div className={`auth-tabs-content ${activeTab === "sign-in" ? "sign-in-active" : "sign-up-active"}`}>
                    {/* Sign In Tab Content */}
                    <form onSubmit={handleSubmit} id="auth-tab-content-sign-in"
                         className={`auth-tab-content ${activeTab === "sign-in" ? "active" : ""}`}>
                        <Input onChange={(e) => setEmail(e.target.value)} name="email" label="Email" type="email"
                               required={true} value={email}/>
                        <Input onChange={(e) => setPassword(e.target.value)} name="password" label="Password"
                               type="password" required={true} value={password}/>
                        <button className="btn btn-s w-100 mt-auto p-2">Login</button>
                    </form>

                    {/* Sign Up Tab Content */}
                    <form onSubmit={handleSubmit} id="auth-tab-content-sign-up"
                         className={`auth-tab-content  ${activeTab === "sign-up" ? "active" : ""}`}>
                        <Input onChange={(e) => setName(e.target.value)} name="name" label="Name" type="text"
                               required={true} value={name}/>
                        <Input onChange={(e) => setEmail(e.target.value)} name="email" label="Email" type="email"
                               required={true} value={email}/>
                        <Input onChange={(e) => setPassword(e.target.value)} name="password" label="Password"
                               type="password" required={true} value={password}/>
                        <Input onChange={(e) => setConfirmPassword(e.target.value)} name="confirm-password"
                               label="Confirm Password" type="password" required={true} value={confirmPassword}/>
                        <button className="btn btn-s w-100 mt-auto p-2">Register</button>
                    </form>
                </div>
            </div>
        </div>
    );
}
