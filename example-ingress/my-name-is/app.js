const express = require('express');
const app = express();
const os = require('os');

app.get('/', (req, res) => res.send(os.hostname()));

app.listen(3000, () => console.log('Listening on port 3000!'))