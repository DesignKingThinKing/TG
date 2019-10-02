'use strict';
require('dotenv').config({ silent: true });

// dependencies
const express = require('express');
const botTelegram = require('node-telegram-bot-api');
const AssistantV1 = require('ibm-watson/assistant/v1');

const server = express();

// // database dependencies

const mysql = require('mysql');
const conn=mysql.createConnection({
	host:'101.101.160.73',
	user:'root',
	password:'xpffprmfoaRlfl123',
	database:'song'
});

conn.connect();

let A;

conn.query('select * from ex', function(err, results, fields){
	A=results;
	if (err) throw err;
	console.log('The result is', A[0].title);
});

conn.end();
/**
 * Context object is useful to assistant cause continue the same conversation (conversation_id)
 * Port is used when starting express server
 */
const port = 8080;
let context = {}

/**
 * Insert your Credentials accordingly
 * For enviroment variables work, you must edit the file .env.example to .env (README.MD)
 */
const wAssistant = new AssistantV1({
	version: '2019-02-28',
    username: process.env.ASSISTANT_USERNAME,
    password: process.env.ASSISTANT_PASSWORD, 
	url: process.env.WATSON_URL,
});
console.log(process.env)
/**
 * Initializing bot using your generated token on Telegram /botfather (README.MD)
 */
const telegram = new botTelegram(process.env.TOKEN_TELEGRAM, { polling: true });

telegram.on('message', (msg) => {
	const chatId = msg.chat.id;	
	console.log('message', msg.text);

	wAssistant.message({
		workspace_id: process.env.WORKSPACE_ID,
		input: {'text': msg.text},
		context: context
	},(err, response) => {
		if (err)
			console.log('error:', err);
		else {
			context = response.context;
			telegram.sendMessage(chatId, response.output.text[0]+A[0].title);
		}
	});	
});

server.listen(port, function(req, res) {
  console.log(`Use localhost:${port} on the browser to check the server`);
});