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

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
});

// MongoDB
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db('batepapo-uol');
});

// Participants routes
server.get('/participants', async (req, res) => {
    try {
        const data = await db.collection('participants').find().toArray();
        res.status(200).send(data);
    } catch (err) {
        res.sendStatus(500);
        return;
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
        res.sendStatus(500);
        return;
    }

    try {
        await db.collection('messages').insertOne({
            'from': req.body.name,
            'to': 'Todos',
            'text': 'entra na sala...',
            'type': 'status',
            'time': dayjs().format('HH:mm:ss')
        })
    } catch (err) {
        res.sendStatus(500);
        return;
    }

    res.sendStatus(201);
});

// Messages routes
server.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit);
    const { user } = req.headers;
    const dbQuery = { $or: [
        { from: user },
        { to: {$in: [user, 'Todos']} }
    ]};
    const dbSort = { time: -1 };
    let data;

    try {
        if (limit) {
            data = await db.collection('messages')
                .find(dbQuery)
                .sort(dbSort)
                .limit(limit)
                .toArray();
        } else {
            data = await db.collection('messages')
                .find(dbQuery)
                .sort(dbSort)
                .toArray();
        }
    } catch (err) {
        res.sendStatus(500);
        return;
    }

    res.status(200).send(data);
});

server.post('/messages', async (req, res) => {
    const validation = messageSchema.validate(req.body);
    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    const { user } = req.headers;
    try {
        const data = db.collection('participants').findOne({
            name: user
        });
        if (!data) {
            res.sendStatus(422);
            return;
        }
    } catch (err) {
        res.sendStatus(500);
        return;
    }

    try {
        db.collection('messages').insertOne({
            'from': user,
            'to': req.body.to,
            'text': req.body.text,
            'type': req.body.type,
            'time': dayjs().format('HH:mm:ss')
        });
    } catch (err) {
        res.sendStatus(500);
        return;
    }
    
    res.sendStatus(201);
})

server.listen(5000, () => {
    console.log('Listening at port 5000...');
});

