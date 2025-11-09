import React from "react";
import HeaderHome from "./components/HeaderHome";
import Footer from "./components/Footer";
import {Helmet} from "react-helmet";
import AuthForm from "./components/AuthForm";
import AuthForm2 from "./components/AuthForm2";

export default function Home() {
    return (
        <>
            <Helmet>
                <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap"
                      rel="stylesheet"/>
            </Helmet>
            <div className={'wrapper'}>
                <div className={'content'}>
                    <HeaderHome/>
                    <AuthForm2/>
                </div>
                <Footer/>
            </div>
        </>
    );
}
