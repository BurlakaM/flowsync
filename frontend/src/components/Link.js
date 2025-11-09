import React from "react";


export default function Link({href, text}) {
    return (
        <>
            <a href={href} className={"text-secondary text-decoration-none"}> {text}</a>
        </>
    );
}
