import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.post('/api/generate-deck', async (req, res) => {
    try {
        const { playerCount, cardsPerPlayer } = req.body;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Génère une configuration de deck pour le jeu "Renard et Spectre" pour ${playerCount} joueurs avec ${cardsPerPlayer} cartes chacun.
    Les types de cartes sont : R (Renard), F (Fantôme), S (Solo), I (Innocent).
    Renvoie UNIQUEMENT un objet JSON valide avec cette structure :
    {
      "players": [
        { "id": 1, "name": "Joueur 1", "cards": ["Carte1", "Carte2", ...], "allegiance": "..." },
        ...
      ]
    }`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Nettoyage du texte si Gemini renvoie du markdown (blocs ```json)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

        res.json(jsonData);
    } catch (error) {
        console.error('Erreur Gemini:', error);
        res.status(500).json({ error: "Erreur lors de la génération de l'IA" });
    }
});

app.listen(port, () => {
    console.log(`Proxy serveur lancé sur http://localhost:${port}`);
});
