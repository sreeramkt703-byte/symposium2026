
import React from "react";
import "./LockScreen.css";

export default function LockScreen({
  reason = "A security violation was detected.",
  team = "",
}) {
  return (
    <main className="exam-lock-screen">
      <section className="exam-lock-card">
        <div className="exam-lock-icon" aria-hidden="true">🔒</div>
        <h1>Exam Locked</h1>
        <p className="exam-lock-message">
          Your exam session has been paused by the security system.
        </p>
        {team && <p className="exam-lock-team">Team: {team}</p>}
        <p className="exam-lock-reason">{reason}</p>
        <p className="exam-lock-help">
          Please contact the exam administrator to request a review.
        </p>
      </section>
    </main>
  );
}