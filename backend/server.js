require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

//Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());