const fs = require('fs');
const request = require('request');

const clientId = 'qzqrzckdb6';
const clientSecret = '9XuaJ7GvnX6FCdPHzPwEs7Pg1S7LkU5G0NwC4zfg';

let obj;

// language => 언어 코드 ( Kor, Jpn, Eng, Chn )
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

stt('Kor', '음성파일.m4a');
