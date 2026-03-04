import fs, { Utf8Stream } from 'fs'

const key = fs.readFileSync('./firebase-private-key.json','utf8')

const base64 = Buffer.from(key).toString('base64')


console.log(base64)
