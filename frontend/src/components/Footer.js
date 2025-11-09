import React from "react";
import Link from "./Link";

export default function Footer() {
  return (
    <>
      <div className={'footer p-3 gap-3'}>
        <p className={'text-center text-secondary m-0'}>© 2025. All rights reserved.</p>
         <Link href={'#'} text={'Privacy Policy'} />
         <Link href={'#'} text={'Terms of Use'} />
         <Link href={'#'} text={'Contact Us'} />
         <Link href={'#'} text={'About'} />
      </div>
    </>
  );
}
