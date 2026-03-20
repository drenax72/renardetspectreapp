import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // CORS configuration for Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { playerCount, cardsPerPlayer } = req.body;
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
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

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

        res.status(200).json(jsonData);
    } catch (error) {
        console.error('Erreur Gemini:', error);
        res.status(500).json({ 
            error: "Erreur lors de la génération de l'IA", 
            details: error.message || error.toString() 
        });
    }
}
