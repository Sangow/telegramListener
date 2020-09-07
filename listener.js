const { MTProto, getSRPParams } = require('@mtproto/core');
const prompts = require('prompts');
const request = require('request-promise')

const api_id = 1111; // insert api_id here
const api_hash = 'xxx'; // insert api_hash here

async function getPhone() {
    return (await prompts({
        type: 'text',
        name: 'phone',
        message: 'Enter your phone number:'
    })).phone
}

async function getCode() {
    return (await prompts({
        type: 'text',
        name: 'code',
        message: 'Enter the code sent:',
    })).code
}

async function getPassword() {
    return (await prompts({
        type: 'text',
        name: 'password',
        message: 'Enter Password:',
    })).password
}


const mtproto = new MTProto({
    api_id,
    api_hash,
});

function startListener() {
    console.log('[+] starting listener')
    mtproto.updates.on('updates', ({ updates }) => {
        const newChannelMessages = updates.filter((update) => update._ === 'updateNewChannelMessage').map(({ message }) => message)

        for (const message of newChannelMessages) {
            // if ( message.to_id.channel_id == 1157435673 ) {
                console.log(`[${message.to_id.channel_id}] ${message.message}`)
                
                // @param bot_token - bot token that you created with @botFather
                // @param chat_id   - chat_id of your channel
                // !!!IMPORTANT!!! make your bot as Administrator in your channel
                
                // request(encodeURI("https://api.telegram.org/bot<bot_token>/sendMessage?chat_id=-1001344419957&text=" + message.message))
                // return
            // }
        }
    });
}


mtproto
    .call('users.getFullUser', {
        id: {
            _: 'inputUserSelf',
        },
    })
    .then(startListener)
    .catch(async error => {

        console.log('[+] You must log in')
        const phone_number = await getPhone()

        mtproto.call('auth.sendCode', {
            phone_number: phone_number,
            settings: {
                _: 'codeSettings',
            },
        })
            .catch(error => {
                if (error.error_message.includes('_MIGRATE_')) {
                    const [type, nextDcId] = error.error_message.split('_MIGRATE_');

                    mtproto.setDefaultDc(+nextDcId);

                    return sendCode(phone_number);
                }
            })
            .then(async result => {
                return mtproto.call('auth.signIn', {
                    phone_code: await getCode(),
                    phone_number: phone_number,
                    phone_code_hash: result.phone_code_hash,
                });
            })
            .catch(error => {
                if (error.error_message === 'SESSION_PASSWORD_NEEDED') {
                    return mtproto.call('account.getPassword').then(async result => {
                        const { srp_id, current_algo, srp_B } = result;
                        const { salt1, salt2, g, p } = current_algo;

                        const { A, M1 } = await getSRPParams({
                            g,
                            p,
                            salt1,
                            salt2,
                            gB: srp_B,
                            password: await getPassword(),
                        });

                        return mtproto.call('auth.checkPassword', {
                            password: {
                                _: 'inputCheckPasswordSRP',
                                srp_id,
                                A,
                                M1,
                            },
                        });
                    });
                }
            })
            .then(result => {
                console.log('[+] successfully authenticated');
                startListener()
            });
    })