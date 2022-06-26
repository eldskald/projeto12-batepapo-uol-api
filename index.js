import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import cors from 'cors';

dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db('batepapo-uol');
});

server.get('/participants', async (req, res) => {
    try {
        const data = await db.collection('participants').find().toArray();
        console.log('foi');
        res.status(200).send(data);
    } catch (err) {
        res.sendStatus(err.response.status);
    }
});

server.listen(5000, () => {
    console.log('Listening at port 5000...');
});

