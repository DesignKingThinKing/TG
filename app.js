'use strict';
require('dotenv').config({ silent: true });

var express = require('express');
const botTelegram = require('node-telegram-bot-api');
const AssistantV1 = require('ibm-watson/assistant/v1');

var app = express();
var client_id = 'qzqrzckdb6';
var client_secret = '9XuaJ7GvnX6FCdPHzPwEs7Pg1S7LkU5G0NwC4zfg';
var fs = require('fs');

const port = 8080;
let context = {}
let RESULTExample;
let ResultText, obj;

// DB
const mysql = require('mysql');
const conn=mysql.createConnection({
	host:'101.101.160.73',
	user:'root',
	password:'xpffprmfoaRlfl123',
	database:'song'
});
conn.connect();

conn.query('select * from ex', function(err, results, fields){
	ResultText = results;
	if (err) throw err;
	console.log('The result is',ResultText[0].title);
});

conn.end();
// DB end

// Assistant
const wAssistant = new AssistantV1({
	version: '2019-02-28',
    username: process.env.ASSISTANT_USERNAME,
    password: process.env.ASSISTANT_PASSWORD, 
	url: process.env.WATSON_URL,
});
console.log(process.env)

const telegram = new botTelegram(process.env.TOKEN_TELEGRAM, { polling: true });

// Telegram
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
			RESULTExample = response.output.text[0]+A[0].title;
		}
	});	
});

// TTS
app.get('/tts', function(req, res) {
	var api_url = 'https://naveropenapi.apigw.ntruss.com/voice/v1/tts';
	var request = require('request');
	var options = {
	  url: api_url,
	  form: { speaker: 'mijin', speed: '0', text: String(RESULTExample)}, // result를 여기에 넣어 tts
	  headers: { 'X-NCP-APIGW-API-KEY-ID': client_id, 'X-NCP-APIGW-API-KEY': client_secret },
	};
	var writeStream = fs.createWriteStream('./tts1.mp3');
	var _req = request.post(options).on('response', function(response) {
	  console.log(response.statusCode); // 200
	  console.log(response.headers['content-type']);
	});
	_req.pipe(writeStream); // file로 출력
	_req.pipe(res); // 브라우저로 출력
});

// STT
function stt(language, filePath) {
    const url = `https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=${language}`;
    const requestConfig = {
        url: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'X-NCP-APIGW-API-KEY-ID': clientId,
            'X-NCP-APIGW-API-KEY': clientSecret
        },
        body: fs.createReadStream(filePath)
    };

    request(requestConfig, (err, response, body) => {
        if (err) {
            console.log(err);
            return;
        }

        //console.log(response.statusCode);
        //console.log(body);
        obj = JSON.parse(body).text;
        console.log("body is "+obj);
    });
}

stt('Kor', 'tts1.mp3'); // tts1.mp3의 음성을 읽어 obj에 저장

app.listen(port, function(req, res) {
  console.log(`Use localhost:${port} on the browser to check the server`);
});