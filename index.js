let express = require('express');
let cors = require('cors');
let mongoose = require('mongoose');
const {ObjectId} = require('mongodb');
let shortId = require('shortid');

let app = express();

app.use(express.static('public'));
app.use(cors({ optionsSuccessStatus: 200 }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// connect DB

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
});

const mongooseConnection = mongoose.connection;
mongooseConnection.once('open', () => console.log("DB connected"));
mongooseConnection.on('error', (err) => console.log(err));

// schema

const { Schema } = mongoose;

const userSchema = new Schema({
  username: String,
  _id: String,
  log: [{ description: String, duration: Number, date: String }]
})

const user = mongoose.model("user", userSchema);

// entry points

app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'));

// create new user:

app.post('/api/exercise/new-user', async (req, res) => {
  const username = req.body.username;
  // const _id = shortId.generate();
  const _id = ObjectId();

  const userInDb = await user.findOne({ username })
    .catch(err => console.log(err));
  if (userInDb) return res.json({ error: "user already exists" })
  let newUser = new user({ username, _id });
  await newUser.save()
    .catch(err => console.log(err));
  res.json({ _id: newUser._id, username: newUser.username });
});

// add exercise:

// PROBLEM: need to update the user (problem with syntax)

app.post('/api/exercise/add', async (req, res) => {
  const id = req.body.userId;
  const description = req.body.description;
  const duration = Number(req.body.duration);
  let date = req.body.date;
  if (date === '') {
    date = new Date().toDateString();
  } else {
    date = new Date(date).toDateString();
  }
  
  await user.findById(id, (err, person) => {
    if (err) {
      console.log('finById err: ', err);
      res.json({ error: "no user found" });
    } else if (person === null) {
      res.json({ error: "no user found" });
    } else {
      person.log.push({ description, duration, date });
      person.save((err, updatedPerson, done) => {
        if (err) return console.log(err);
        // done(null, updatedPerson);
      });
      res.json({
        _id: person.id,
        username: person.username,
        date,
        duration,
        description
      })
    }
  })
});

// retrieve all users:

app.get('/api/exercise/users', async (req, res) => {
  const allUsers = await user.find({}, {__v: 0})
    .catch(err => console.log(err));
  res.send(allUsers);
})

// retrive exercise log of user

app.get('/api/exercise/log?', async (req, res) => {
  const { userId, from, to, limit } = req.query;

  const userLog = await user.findById(userId, (err, person) => {
    let responseLog = [...person.log];
    if (err) {
      console.log('finById err: ', err);
      res.json({ error: "no user found" });
    } else if (person === null) {
      console.log('person === null')
      res.json({ error: "no user found" });
    } else {
      if (from) {
        const fromDate = new Date(from);
        responseLog = responseLog.filter(exercise => new Date(exercise.date) >= fromDate);
      }
      if (to) {
        const toDate = new Date(to);
        responseLog = responseLog.filter(exercise => new Date(exercise.date) <= toDate);
      }
      if (limit) {
        responseLog = responseLog.filter((exercise, index) => index + 1 <= limit);
      }
      res.json({
        _id: person.userId,
        username: person.username,
        log: responseLog,
        count: responseLog.length
      });
    }
  })
})

// listener

let listener = app.listen(process.env.PORT, () => console.log("connected"));
