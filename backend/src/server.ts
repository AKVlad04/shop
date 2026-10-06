import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Încărcăm variabilele de mediu
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware de bază
app.use(cors());
app.use(express.json());

// O rută de test simplă
app.get('/', (req, res) => {
  res.send({ message: 'Backend-ul funcționează perfect!' });
});

// Pornirea serverului
app.listen(PORT, () => {
  console.log(`Serverul rulează pe portul ${PORT}`);
});