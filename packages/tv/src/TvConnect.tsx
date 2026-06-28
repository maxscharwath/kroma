import { useState } from 'react';
import { Button, Logo } from '@luma/ui';
import { useConnection } from '#tv/connection';
import { useFocusNav } from '#tv/useFocusNav';

/**
 * Server discovery / connection screen. Prop-free — reads everything from
 * useConnection(). The router's guard shows it whenever status !== 'ready'.
 */
export function TvConnect() {
  const { status, serverUrl, error, platform, connect, discover } = useConnection();
  const [value, setValue] = useState(serverUrl ?? 'http://luma.local:4040');
  const discovering = status === 'discovering';
  // Wire the remote: spatial focus + OK across the input and buttons. Re-runs on
  // status change so focus lands on the right control (button vs. form).
  useFocusNav({ resetKey: status });

  const heading = discovering
    ? 'Recherche du serveur LUMA…'
    : status === 'connecting'
      ? 'Connexion au serveur…'
      : 'Serveur LUMA introuvable';
  const sub = discovering
    ? 'Détection automatique sur le réseau local (mDNS).'
    : status === 'connecting'
      ? `Connexion à ${serverUrl}`
      : `Vérifiez que le serveur est démarré sur le réseau (${platform}), ou saisissez son adresse.`;

  return (
    <div className="grid min-h-screen place-items-center p-16 text-center">
      <div className="max-w-[680px]">
        <div className="mb-7">
          <Logo size={44} />
        </div>
        <h1 className="m-0 mb-3 font-display text-[38px] font-bold">{heading}</h1>
        <p className="font-display text-[20px] font-normal text-muted">{sub}</p>
        {error ? <p className="font-sans text-[13px] text-dim">{error}</p> : null}

        {discovering ? (
          <div className="mt-6">
            <Button data-focus="" onClick={discover}>
              Rechercher à nouveau
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              connect(value.trim());
            }}
            className="mx-auto mt-6 flex w-full max-w-[520px] flex-col gap-4"
          >
            <input
              data-focus=""
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="http://luma.local:4040"
              spellCheck={false}
              className="w-full rounded-[10px] border border-border-strong bg-surface-2 px-5 py-4 text-center font-sans text-[18px] text-text"
            />
            <div className="flex justify-center gap-3.5">
              <Button type="submit" data-focus="">
                Connecter
              </Button>
              <Button type="button" variant="glass" data-focus="" onClick={discover}>
                Détecter
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
