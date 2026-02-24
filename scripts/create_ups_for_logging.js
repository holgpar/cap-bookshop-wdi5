const { execSync } = require("child_process");
const fs = require('fs');


function mustGetEnv(name) {
  const result = process.env[name]
  if(!result) {
    throw new Error(`missing ${name} environmnet variable`);
  }
  return result
}

function run(command) {
  execSync(command, { stdio: "inherit" });
}

function runAndReturnOutput(command) {
    const output = execSync(command, { stdio: ['inherit', 'pipe', 'inherit'] });
    return output.toString();
}

function installCfCli() {
  console.log('downloading CF cli...')
  const cmd = `
    wget -q "https://packages.cloudfoundry.org/stable?release=linux64-binary&source=github" -O cf-cli.tgz \
    && tar -xzf cf-cli.tgz cf cf8 -C ./tools \
    && rm cf-cli.tgz`;
  run(cmd);
}

function authenticate() {
  const certificateCredential = JSON.parse(mustGetEnv('CERT_CRED'));

  fs.writeFileSync("certificate.pm", certificateCredential.pemCertificates)
  fs.writeFileSync("key.pem", certificateCredential.pemPrivateKey)

  const  passcodeOutput = runAndReturnOutput(`wget -qO - --certificate certificate.pm --private-key key.pem \
    https://${certificateCredential.hostname}/service/users/passcode`)

  const passcode = JSON.parse(passcodeOutput).passcode

  console.log("authenticating against CF...")
  run(`
    ./cf login -a https://api.cf.eu12.hana.ondemand.com -o CLOUDCIDEV_cicddev -s d057760-deploy-target \
    -u "${certificateCredential.emailAddress}" -p '${passcode}' --origin "${certificateCredential.origin}"
    `)
}

function createUpsForSysLogDrain() {
  const syslogDrainUrl = mustGetEnv('SYSLOG_DRAIN_URL')
  const serviceKey = mustGetEnv('LOGGING_SERVICE_KEY')

  fs.writeFileSync("loggingServiceKey.json", serviceKey)

  console.log("creating user provided service")
  //TODO: update service instance if already existing
  run( `./cf create-user-provided-service cloud-logging -l '${syslogDrainUrl}' -p ./loggingServiceKey.json`)
}


installCfCli();
authenticate();
createUpsForSysLogDrain()
