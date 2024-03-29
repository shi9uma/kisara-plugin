import plugin from '../../../lib/plugins/plugin.js'
import tools from '../utils/tools.js'
import lodash from 'lodash'
import similarity from 'string-similarity'

// 自机聊天
export class chat extends plugin {
    constructor() {
        super(
            {
                name: '自机聊天',
                dsc: '聊天 bot',
                event: 'message',
                priority: 8000,
                rule: [
                    {
                        reg: '^(.*)$',
                        fnc: 'chat',
                        log: false
                    }
                ]
            }
        )

        this.pluginName = tools.getPluginName()
        this.prefix = `[+] ${this.name}`
    }

    handleMessage(message, keyDict) {
        message = message.replaceAll('{me}', keyDict.botName)
        message = message.replaceAll('{name}', keyDict.senderName)
        let msgList
        if (message.includes('{segment}')) {
            msgList = message.split('{segment}')
        }
        return msgList ? msgList : [].concat(message)
    }

    dontAnswer(keyDict, msg) {
        if (msg == '') return true  // 空消息不回复
        if (this.e.source?.user_id ? (this.e.source.user_id != Bot.uin) : false) return true   // 非回复本人不回复
        if (keyDict.ngWords.includes(msg)) return true  // ngWords 不回复
        if (keyDict.banList.includes(this.e.sender.user_id.toString())) return true // ban 账号不回复
        return (
            (tools.isAtSomeone(this.e, Bot.uin) ? (keyDict.atReply ? true : false) : false) ||
            (this.e.isMaster ? (tools.checkAt(this.e) ? (tools.isAtSomeone(this.e, Bot.uin) ? true : false) : true) : false) ||
            keyDict.isReplyList.includes(this.e.sender.user_id.toString()) ||
            lodash.random(1, 100) <= keyDict.triggerRate
        ) ? false : true // 主人回复, 必回 QQ, 触发概率, at 回复
    }

    async doReply(chatData, _msg, keyDict) {
        let replyMsg = this.handleMessage(lodash.sample(chatData[_msg]), keyDict)
        if (replyMsg.length > 1) {
            for (let eachMsg of replyMsg) {
                await this.e.reply(eachMsg)
                await tools.wait(lodash.random(1, 5))
            }
        } else {
            await this.e.reply(replyMsg[0])
        }
        return
    }

    async chat() {
        let _keyDict = {
            botName: '',
            senderName: '',
            triggerRate: '',
            similarityRate: '',
            ngWords: '',
            isReplyList: '',
            banList: '',
            atReply: ''
        }
        let keyDict = tools.applyCaseConfig(_keyDict, this.e.group_id, 'chat', 'chat'),
            msg = this.e.msg ? this.e.msg.replaceAll(keyDict.botName, '') : ''

        if (this.dontAnswer(keyDict, msg)) return

        let chatLibPath = `./plugins/${this.pluginName}/data/chatLibrary/lib/1.5w.json`,
            chatData = tools.readJsonFile(chatLibPath),
            similarityList = []

        for (let _msg in chatData) {
            if (_msg == msg) {  // 词库中找到了键值对的情况
                await this.doReply(chatData, _msg, keyDict)
                return
            }
            let similarityRate = similarity.compareTwoStrings(_msg, msg)
            if (similarityRate * 100 >= Number(keyDict.similarityRate)) {
                similarityList.push({
                    similarityRate: similarityRate,
                    _msg: _msg,
                    msg: msg
                })
            }
        }

        if (similarityList.length > 0) {
            // 按照相似度从大到小排序, 取相似度最高的
            similarityList = lodash.orderBy(similarityList, ['similarityRate'], ['desc'])
            await this.doReply(chatData, similarityList[0]._msg, keyDict)
        }

        return
    }
}