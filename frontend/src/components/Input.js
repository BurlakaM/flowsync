import React, { useState } from "react";

export default function Input({ name, label, className,onChange,value, required = false,  type = "text" }) {
    const firstClassName = "input__item";

    if (className) {
        className = className + " " + firstClassName;
    }
    return (
        <div className="input-wrapper">
            <div className="input-title">
                <p className={'p-0'}>{label} <span className="error-span d-none"></span></p>
            </div>
            <div className="input">
                <input
                    className={className}
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required={required ? 'required' : ''}
                />
            </div>
        </div>
    );
}
