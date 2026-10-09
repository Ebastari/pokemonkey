import React from 'react';
import { SKINS } from '../constants';
import { useFotoProfil } from '../lib/foto';
import { AvatarSkin, KELANGKAAN } from './LatarSkin';

/**
 * Foto profil anggota: foto yang diunggah sendiri bila ada; bila belum, skin yang
 * sedang dipakai menjadi foto profil bawaan (bingkai warna kelangkaan skin).
 */
export const AvatarAnggota: React.FC<{ foto?: string | null; skinId?: string | null; ukuran?: number; className?: string }> = ({
  foto, skinId, ukuran = 40, className = '',
}) => {
  const url = useFotoProfil(foto);
  const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0];
  if (url) {
    return (
      <span className={`inline-block overflow-hidden shrink-0 border-2 ${className}`} style={{ width: ukuran, height: ukuran, borderColor: KELANGKAAN[skin.tier]?.bingkai }}>
        <img src={url} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  return <AvatarSkin skin={skin} ukuran={ukuran} className={className} />;
};
