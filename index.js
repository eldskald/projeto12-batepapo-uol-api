import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import cors from 'cors';
import dayjs from 'dayjs';
import { stripHtml } from 'string-strip-html';

dotenv.config();

const server = express();
server.use(express.json());
server.use(cors());



// Validation -----------------------------------------------------------------
const participantSchema = joi.object({
    name: joi.string().required()
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
});

function objectStripHtml (obj) {
    const entries = Object.entries(obj);
    for (let i = 0; i < entries.length; i++) {
        if (typeof entries[i][1] === 'string') {
            entries[i][1] = stripHtml(entries[i][1]).result;
        }
    }
    return Object.fromEntries(entries);
}
// ----------------------------------------------------------------------------



// MongoDB --------------------------------------------------------------------
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db('batepapo-uol');
});
// ----------------------------------------------------------------------------



// Participants routes --------------------------------------------------------
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
    const body = objectStripHtml(req.body);
    const validation = participantSchema.validate(body);
    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    try {
        const data = await db.collection('participants').findOne({
            'name': body.name
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
            'name': body.name,
            'lastStatus': Date.now()
        });
    } catch (err) {
        res.sendStatus(500);
        return;
    }

    try {
        await db.collection('messages').insertOne({
            'from': body.name,
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
// ----------------------------------------------------------------------------



// Messages routes ------------------------------------------------------------
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
    const body = objectStripHtml(req.body);
    const validation = messageSchema.validate(body);
    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    const { user } = req.headers;
    try {
        const data = await db.collection('participants').findOne({
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
        await db.collection('messages').insertOne({
            'from': user,
            'to': body.to,
            'text': body.text,
            'type': body.type,
            'time': dayjs().format('HH:mm:ss')
        });
    } catch (err) {
        res.sendStatus(500);
        return;
    }
    
    res.sendStatus(201);
})
// ----------------------------------------------------------------------------



// Status routes and inactive users remotion ----------------------------------
server.post('/status', async (req, res) => {
    const { user } = req.headers;
    let id;

    try {
        const data = await db.collection('participants').findOne({
            'name': user
        });
        if (data) {
            id = data._id;
        } else {
            res.sendStatus(404);
            return;
        }
    } catch (err) {
        res.sendStatus(500);
        return;
    }

    try {
        await db.collection('participants').updateOne(
            { _id: id },
            { $set: { lastStatus: Date.now() } }
        );
    } catch (err) {
        res.sendStatus(500);
        return;
    }

    res.sendStatus(200);
});

setInterval(async () => {
    const now = Date.now();
    let users;

    try {
        const data = await db.collection('participants').find().toArray();
        users = [...data];
    } catch (err) {
        return;
    }

    for (let i = 0; i < users.length; i++) {
        if (now - users[i].lastStatus > 10000) {
            try {
                await db.collection('participants').deleteOne({
                    _id: users[i]._id
                });
            } catch (err) {
                return;
            }

            try {
                await db.collection('messages').insertOne({
                    'from': users[i].name,
                    'to': 'Todos',
                    'text': 'sai da sala...',
                    'type': 'status',
                    'time': dayjs().format('HH:mm:ss')
                });
            } catch (err) {
                return;
            }
        }
    }

}, 15000)
// ----------------------------------------------------------------------------



// Server listen --------------------------------------------------------------
server.listen(5000, () => {
    console.log('Listening at port 5000...');
});

