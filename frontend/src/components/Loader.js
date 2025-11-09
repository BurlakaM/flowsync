import react from "react";
import React from "react";

export default function Loader({text = "Loading..."}) {
    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "#fff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "20px"
        }}>
            {text}
        </div>
    );
}