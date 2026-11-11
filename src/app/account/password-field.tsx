"use client";

import { useState } from "react";

export function PasswordField({ newPassword }: { newPassword: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field">
    <label htmlFor="account-password">Password</label>
    <div className="password-input">
      <input id="account-password" name="password" type={visible ? "text" : "password"}
        aria-describedby={newPassword ? "password-help" : undefined}
        autoComplete={newPassword ? "new-password" : "current-password"}
        minLength={newPassword ? 8 : 1} maxLength={newPassword ? 72 : 128} required />
      <button className="password-toggle" type="button" aria-controls="account-password" aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible(!visible)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  </div>;
}
