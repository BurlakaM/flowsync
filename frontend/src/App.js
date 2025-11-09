import React from "react";
import "./assets/css/App.css";
import {BrowserRouter, Routes, Route} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Home from "./Home";
import Login from "./auth/Login";
import Dashboard from "./cabinet/Dashboard";
import ProtectedRoute from "./ProtectedRoute";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login/>}/>
                <Route path="/" element={<Home/>}/>

                <Route element={<ProtectedRoute/>}>
                    <Route path="/dashboard" element={<Dashboard/>}/>
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
