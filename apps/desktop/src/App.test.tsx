import React from "react";

const TestApp: React.FC = () => {
  console.log("TestApp component is rendering");

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      backgroundColor: "#ff0000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: "24px",
      fontWeight: "bold"
    }}>
      HELLO WORLD - TEST COMPONENT
    </div>
  );
};

export default TestApp;
