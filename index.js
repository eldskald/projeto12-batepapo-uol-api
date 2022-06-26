import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import cors from 'cors';
import dayjs from 'dayjs';

dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());

// joi validation schemas
const participantSchema = joi.object({
    name: joi.string().required()
});

// MongoDB
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db('batepapo-uol');
});

// Participant routes
server.get('/participants', async (req, res) => {
    try {
        const data = await db.collection('participants').find().toArray();
        res.status(200).send(data);
    } catch (err) {
        res.sendStatus(err.response.status);
    }
});

server.post('/participants', async (req, res) => {
    const validation = participantSchema.validate(req.body);
    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    try {
        const data = await db.collection('participants').findOne({
            'name': req.body.name
        });
        if (data) {
            res.sendStatus(409);
            return;
        }
    } catch (err) {
        res.sendStatus(500);
        return;
    }

    try {
        await db.collection('participants').insertOne({
            'name': req.body.name,
            'lastStatus': Date.now()
        });
    } catch (err) {
        res.sendStatus(err.response.status);
    }

    try {
        const time = dayjs().format('HH:mm:ss');
        await db.collection('messages').insertOne({
            'from': 'xxx',
            'to': 'Todos',
            'text': 'entra na sala...',
            'type': 'status',
            'time': time
        });
    } catch (err) {
        res.sendStatus(err.response.status);
        return;
    }

    res.sendStatus(201);
});

server.listen(5000, () => {
    console.log('Listening at port 5000...');
});

