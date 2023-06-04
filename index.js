const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

app.use(cors());
// req.bodyを使うために必要！！
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

mongoose.set('strictQuery', false);
const mongooseUri = process.env.MONGO_URI;

mongoose.connect(mongooseUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
mongoose.connection.once('open', () => {
  console.log('MongoDB connected!');
});

const Schema = mongoose.Schema;
// user スキーマ
const userSchema = new Schema({
  username: { type: String, unique: true, required: true },
});
const User = mongoose.model('User', userSchema);
// exercise スキーマ
const exerciseSchema = new Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, min: 1, required: true },
  date: { type: Date, default: Date.now },
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

// ユーザーの追加
app.post('/api/users', (req, res) => {
  console.log(req.body);
  const username = req.body.username;
  const user = new User({ username: username });
  user.save((err, data) => {
    if (err) {
      console.log(err);
      res.send('error');
    } else {
      res.json({ username: data.username, _id: data._id });
    }
  });
});

// ユーザーの取得
app.get('/api/users', (req, res) => {
  User.find({}, (err, data) => {
    if (err) {
      console.log(err);
      res.send('error');
    } else {
      // 配列の中にオブジェクトが入っているので、配列の中のオブジェクトの特定の項目を返す
      const result = data.map((item) => {
        return { username: item.username, _id: item._id };
      });
      res.json(result);
    }
  });
});

// exerciseの追加
app.post('/api/users/:_id/exercises', (req, res) => {
  const userId = req.params._id;
  const description = req.body.description;
  const duration = req.body.duration;
  const date = (req.body.date !== undefined ? new Date(req.body.date) : new Date());
  if (!userId) {
    res.send('userIdは必須です。');
    return;
  }
  // 必須項目のチェック
  if (!description || !duration) {
    res.send('descriptionとdurationは必須です。');
    return;
  }
  // durationが数字かどうかのチェック
  if (isNaN(duration)) {
    res.send('durationは数字で入力してください。');
    return;
  }
  User.findById(userId, (err, data) => {
    if (err) {
      console.log(err);
      res.send('error');
    } else if (!data) {
      res.send('userが存在しません。');
    } else {
      // userIdが存在する場合
      const exercise = new Exercise({
        userId: userId,
        description: description,
        duration: duration,
        date: date,
      });
      // exerciseを保存
      exercise.save((saveErr, saveData) => {
        if (saveErr) {
          console.log(saveErr);
          res.send('error');
        } else {
          res.json({
            _id: data._id,
            username: data.username,
            description: saveData.description,
            duration: saveData.duration,
            date: new Date(saveData.date).toDateString(),
          });
        }
      });
    }
  });


});

// logの取得
app.get('/api/users/:_id/logs', (req, res) => {
  const userId = req.params._id;
  let findConditions = { userId: userId };

  if (
    (req.query.from !== undefined && req.query.from !== '')
    ||
    (req.query.to !== undefined && req.query.to !== '')
  ) {
    findConditions.date = {};

    // fromが指定されている場合
    if (req.query.from !== undefined && req.query.from !== '') {
      findConditions.date.$gte = new Date(req.query.from);
    }
    // fromが不正な日付の場合
    if (findConditions.date.$gte == 'Invalid Date') {
      return res.json({ error: 'from date is invalid' });
    }
    // toのみ指定されている場合
    if (req.query.to !== undefined && req.query.to !== '') {
      findConditions.date.$lte = new Date(req.query.to);
    }
    // toが不正な日付の場合
    if (findConditions.date.$lte == 'Invalid Date') {
      return res.json({ error: 'to date is invalid' });
    }
  }

  let limit = (req.query.limit !== undefined ? parseInt(req.query.limit) : 0);

  if (isNaN(limit)) {
    return res.json({ error: 'limit is not a number' });
  }

  User.findById(userId, function (userFindErr, userFindData) {
    if (!userFindErr && userFindData !== null) {
      Exercise.find(findConditions).sort({ date: 'asc' }).limit(limit).exec(function (exerciseFindErr, exerciseFindData) {
        if (!exerciseFindErr) {
          return res.json({
            _id: userFindData._id,
            username: userFindData.username,
            log: exerciseFindData.map(function (e) {
              return {
                description: e.description,
                duration: e.duration,
                date: new Date(e.date).toDateString()
              };
            }),
            count: exerciseFindData.length
          });
        }
      });
    } else {
      return res.json({ error: 'user not found' });
    }
  });
});





// スキーマのdocument全てを削除
app.get('/api/Exercise/del', (req, res) => {
  Exercise.deleteMany({}, (err, data) => {
    if (err) {
      console.log(err);
      res.send('error');
    } else {
      res.send('complete delete successful');
    }
  });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})