require('dotenv').config();
const express = require('express');
const fs = require('fs');
const app = express();

const DEVICE_ID = '70:ee:50:3d:02:b2';

const MODULES = {
    salon:     { module_id: DEVICE_ID },
    chambre:   { module_id: '03:00:00:08:16:74' },
    garage:    { module_id: '03:00:00:08:19:8e' },
    exterieur: { module_id: '02:00:00:b2:c7:d6' }
};

// Lit le token depuis les variables d'environnement
let ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Fonction pour renouveler le token
async function renouvellerToken() {
    console.log('Renouvellement du token...');
    try {
        const params = new URLSearchParams({
            grant_type:    'refresh_token',
            refresh_token: process.env.REFRESH_TOKEN,
            client_id:     process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET
        });

        const response = await fetch('https://api.netatmo.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await response.json();

        if (data.access_token) {
            ACCESS_TOKEN = data.access_token;

            // Met à jour le fichier .env
            let envContent = fs.readFileSync('.env', 'utf8');
            envContent = envContent.replace(/ACCESS_TOKEN=.*/, `ACCESS_TOKEN=${data.access_token}`);
            envContent = envContent.replace(/REFRESH_TOKEN=.*/, `REFRESH_TOKEN=${data.refresh_token}`);
            fs.writeFileSync('.env', envContent);

            console.log('Token renouvelé avec succès !');
        } else {
            console.error('Erreur renouvellement token :', data);
        }
    } catch (error) {
        console.error('Erreur renouvellement token :', error);
    }
}

// Renouvelle le token toutes les 2h30
setInterval(renouvellerToken, 9000 * 1000);

app.use(express.static('.'));

// Route données temps réel
app.get('/api/stations', async (req, res) => {
    try {
        const response = await fetch('https://api.netatmo.com/api/getstationsdata', {
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erreur API' });
    }
});

// Route historique température
app.get('/api/historique/:module', async (req, res) => {
    const moduleName = req.params.module;
    const moduleInfo = MODULES[moduleName];

    if (!moduleInfo) {
        return res.status(404).json({ error: 'Module inconnu' });
    }

    const maintenant = Math.floor(Date.now() / 1000);
    const ilYa7Jours = maintenant - (7 * 24 * 3600);

    const params = new URLSearchParams({
        device_id:  DEVICE_ID,
        module_id:  moduleInfo.module_id,
        scale:      '3hours',
        type:       'Temperature',
        date_begin: ilYa7Jours,
        date_end:   maintenant,
        optimize:   'false'
    });

    try {
        const response = await fetch(`https://api.netatmo.com/api/getmeasure?${params}`, {
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erreur API' });
    }
});

app.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});