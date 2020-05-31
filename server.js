const express = require("express");
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt-nodejs');
const knex = require('knex');
const Clarifai = require('clarifai');

const clarifaiapp = new Clarifai.App({
  apiKey: 'f0c3bf16a3b1497395e6856bf53df6e8'
 });

const datab=knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: 'user',
    database: 'app'
  }
})

const app = express();
app.use(bodyParser.json());
app.use(cors())

app.get('/',(req,res)=> res.json("app running"))

app.post('/signin', (req,res)=> {
  datab.select('email','hash').from('login')
  .where('email','=',req.body.email)
  .then(data => {
    const isvalid =bcrypt.compareSync(req.body.password,data[0].hash);
    if (isvalid) {
      return datab.select('*').from('users')
        .where('email','=',req.body.email)
        .then(user =>{
          res.json({status:"success",data:user[0]})
        })
        .catch(err => res.status(400).json('unable to get user'))
    }
    else{
      res.status(400).json("wrong credentials")
    }
  })
  .catch(err => res.status(400).json('wrong credentials'))
})

app.post('/register', (req,res)=>{
  const {email,name,password}=req.body;
  const hash = bcrypt.hashSync(password);
  datab.transaction(trx =>{
    trx.insert({
      hash: hash,
      email: email
    })
    .into('login')
    .returning('email')
    .then(loginemail =>{
      return trx("users").returning('*')
      .insert({
        name: name,
        email: loginemail[0],
        joined: new Date()
      })
      .then(response => {
        res.json({status:"success",data:response[0]});})
    })
    .then(trx.commit)
    .catch(trx.rollback)
  })
  .catch(err => res.status(400).json("Unable to Register"))
})

app.get('/profile/:id', (req,res)=>{
  const {id} =req.params;
  datab.select('*').from('users').where({id}).then(user => {
    if (user.length){
      res.json(user[0])
    }
    else {
      res.status(400).json("Not Found")
    }
  })
  .catch(err => res.status(400).json("Error"))
})

app.post("/image",(req,res)=>{
  const{id}=req.body;
  datab('users').where('id','=',id).increment('entries',1)
  .returning('entries')
  .then(entries =>{
    res.json({status:"success",data:entries[0]});
  })
  .catch(err => res.status(400).json("Invalid Id"))
})

app.post("/imageapi",(req,res)=>{
  const{imageurl}=req.body;
  clarifaiapp.models.initModel({id: Clarifai.FACE_DETECT_MODEL})
      .then(generalModel => {
        return generalModel.predict(imageurl);
      })
      .then(response => {
        if ((response.outputs[0].data.regions)) {
          res.json({status:"success",data:response.outputs[0].data.regions});
        }
        else{
          res.status(400).json("No face Image")
        }
      })
  .catch(err => {
    console.log(err)
    res.status(400).json("Api Error")}
    )
})

app.listen(3000, ()=> {
  console.log("app is running on port 3000");
})