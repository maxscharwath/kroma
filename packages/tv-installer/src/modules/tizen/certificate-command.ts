import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineCommand } from 'citty';
import { exitAfter } from '../../exit-after';
import { run } from '../../run';
import { requireTool } from '../../toolchain/detect';
import { style } from '../../tui/ansi';
import { createAuthorCertificate } from './certificate/authority';
import { TIZEN_CLI } from './tools';

const CERTIFICATES = join(homedir(), '.kroma', 'certificates');
const PASSWORD = 'kroma-dev';

export const certificateCommand = defineCommand({
  meta: {
    name: 'certificate',
    description: 'Generate a Samsung author certificate and the profile the tools sign with.',
  },
  args: {
    name: { type: 'string', default: 'kroma', description: 'The profile and alias name' },
    register: {
      type: 'boolean',
      default: false,
      description: 'Add it to the Tizen profiles, which makes it the active one',
    },
  },
  run: ({ args }) => exitAfter(certificate({ name: args.name, register: args.register })),
});

interface CertificateOptions {
  name: string;
  register: boolean;
}

/**
 * Generates an author certificate: an RSA key, a self-signed X.509 over it, and
 * the PKCS#12 the Tizen tools sign with. Registering it is opt-in, because
 * adding a profile makes it the active one and a machine that already signs for
 * a retail set must keep signing with the certificate that set accepts.
 */
async function certificate(options: CertificateOptions): Promise<number> {
  const author = await createAuthorCertificate({
    directory: join(CERTIFICATES, options.name),
    alias: options.name,
    password: PASSWORD,
    subject: { commonName: 'KROMA', organization: 'KROMA' },
  });

  console.log(`${style.green('certificate')}  ${author.certificate}`);
  console.log(`${style.green('key')}          ${author.key}`);
  console.log(`${style.green('archive')}      ${author.archive}  (password ${author.password})`);
  console.log(
    style.dim(
      'The author half only. A retail Samsung also wants a distributor certificate,\nwhich Samsung issues against the DUID of that one set: Tizen Studio, Certificate Manager.',
    ),
  );

  const add = [
    'security-profiles',
    'add',
    '-n',
    options.name,
    '-a',
    author.archive,
    '-p',
    PASSWORD,
  ];
  if (!options.register) {
    console.log(`\nregister it, which also makes it the active profile:\n  tizen ${add.join(' ')}`);
    return 0;
  }

  const { code } = await run([requireTool(TIZEN_CLI), ...add], {
    log: (line) => console.log(line),
  });
  return code === 0 ? 0 : 1;
}
