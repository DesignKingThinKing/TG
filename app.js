'use strict';
require('dotenv').config({ silent: true });

const express = require('express');
const request = require('request');
const botTelegram = require('node-telegram-bot-api');
const AssistantV1 = require('ibm-watson/assistant/v1');
const port = 8080;
const app = express();
const fs = require('fs');

// for tts, stt
const client_id = 'qzqrzckdb6';
const client_secret = '9XuaJ7GvnX6FCdPHzPwEs7Pg1S7LkU5G0NwC4zfg';
let tagSql = 'select * from tagTB where tag="sad"';
let context = {}
//let RESULTExample;
let ResultText, rseResult, obj;
let dbTag, watsonRes;

function messageSplitDB(text){// watson에서 온 응답
	watsonRes=text.split(';'); // watson에서 온 응답을 split으로 나눔
	dbTag=watsonRes[1]; // tag가 들어가는 곳
	console.log("dbTag is "+dbTag);
};

// DB
const mysql = require('mysql');
const conn=mysql.createConnection({
	host:'101.101.160.73',
	user:'root',
	password:'xpffprmfoaRlfl123',
	database:'song'
});
conn.connect();

conn.query(tagSql, dbTag, function(err, results, fields){
	ResultText = results; // 노래의 결과가 저장됨
	if (err) throw err;
	console.log('DB result is',ResultText);
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
		//context: context
	},(err, response) => {
		if (err)
			console.log('error:', err);
		else {
			messageSplitDB(response.output.text[0]);
			context = response.context;
			messageSplitDB("hello;sad");
			telegram.sendMessage(chatId,watsonRes[0]+ResultText[0].title); // 답장, 여기에 url
			//RESULTExample = response.output.text[0]+ResultText[0].title;
		}
	});
});

// TTS - [ipaddress]/tts에 들어갔을 때 음성이 나옴
// app.get('/tts', function(req, res) {
// 	var api_url = 'https://naveropenapi.apigw.ntruss.com/voice/v1/tts';
// 	var request = require('request');
// 	var options = {
// 	  url: api_url,
// 	  form: { speaker: 'mijin', speed: '0', text: String(RESULTExample)}, // result를 여기에 넣어 tts
// 	  headers: { 'X-NCP-APIGW-API-KEY-ID': client_id, 'X-NCP-APIGW-API-KEY': client_secret },
// 	};
// 	var writeStream = fs.createWriteStream('./audio/tts1.mp3'); // tts1.mp3 파일 생성
// 	var _req = request.post(options).on('response', function(response) {
// 	  console.log(response.statusCode); // 200
// 	  console.log(response.headers['content-type']);
// 	});
// 	_req.pipe(writeStream); // file로 출력
// 	_req.pipe(res); // 브라우저로 출력
// });

/*
스피커를 사용했을 때 - 대답해줄 때 왓슨에서 받은 내용을 tts
스피커에 말을 할 때 해당 내용을 stt
*/

function tts(){//req, res) {
	var api_url = 'https://naveropenapi.apigw.ntruss.com/voice/v1/tts';
	var request = require('request');
	var options = {
	  url: api_url,
	  form: { speaker: 'mijin', speed: '0', text: String("좋은")}, // result를 여기에 넣어 tts
	  headers: { 'X-NCP-APIGW-API-KEY-ID': client_id, 'X-NCP-APIGW-API-KEY': client_secret },
	};
	var writeStream = fs.createWriteStream('./audio/tts1.mp3'); // tts1.mp3 파일 생성
	var _req = request.post(options).on('response', function(response) {
	  console.log(response.statusCode); // 200
	  console.log(response.headers['content-type']);
	});
	_req.pipe(writeStream); // file로 출력
	//_req.pipe(res); // 브라우저로 출력
}

// STT
function stt(language, filePath) {
    const url = `https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=${language}`;
    const requestConfig = {
        url: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'X-NCP-APIGW-API-KEY-ID': client_id,
            'X-NCP-APIGW-API-KEY': client_secret
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
        console.log("body is " + obj);
    });
}

tts();
//stt('Kor', './audio/tts1.mp3'); // tts1.mp3의 음성을 읽어 obj에 저장

// 실행
app.listen(port, function(req, res) {
  console.log(`Use localhost:${port} on the browser to check the server`);
});