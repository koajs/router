'use strict'

const chalk = require('chalk')

const operations = 1000000

function now () {
  var ts = process.hrtime()
  return (ts[0] * 1e3) + (ts[1] / 1e6)
}

function getOpsSec (ms) {
  return Number(((operations * 1000) / ms).toFixed()).toLocaleString()
}

function print (name, time) {
  console.log(chalk.yellow(name), getOpsSec(now() - time), 'ops/sec')
}

function title (name) {
  console.log(chalk.green(`
${'='.repeat(name.length + 2)}
 ${name}
${'='.repeat(name.length + 2)}`))
}

function Queue () {
  this.q = []
  this.running = false
}

Queue.prototype.add = function add (job) {
  this.q.push(job)
  if (!this.running) this.run()
}

Queue.prototype.run = function run () {
  this.running = true
  const job = this.q.shift()
  job(() => {
    if (this.q.length) {
      this.run()
    } else {
      this.running = false
    }
  })
}

module.exports = { now, getOpsSec, print, title, Queue, operations }
