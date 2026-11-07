    const express = require("express");
    const app = express();
    app.use(express.json());
    app.get("/",(req,res) => {
        res.send("Codeomax intershipo backend is running!");

    });
    const PORT = 5000;
    app.listen(PORT, () =>{
        console.log(`server running at http://localhost:${PORT}`);
    });