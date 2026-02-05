import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './Guide.css';

export default function Guide() {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguage();

  const content = language === 'ja' ? {
    title: '使い方ガイド',
    close: '閉じる',
    sections: [
      {
        title: '1. 推奨する元素材',
        items: [
          { icon: '⏱️', label: '動画の長さ', value: '3〜30秒' },
          { icon: '📁', label: 'ファイルサイズ', value: '100MB以下' },
          { icon: '🎬', label: '形式', value: 'MP4推奨' },
        ],
        note: '短い動画ほど高速に処理できます'
      },
      {
        title: '2. 解像度と再生時間の目安',
        table: {
          headers: ['解像度', '最大再生時間', 'ファイルサイズ目安'],
          rows: [
            ['1080p (フルHD)', '60分', '約1.2GB'],
            ['4K (超高画質)', '30分以下推奨', '約2.4GB'],
          ]
        },
        note: '4Kの60分はメモリ制限により失敗する可能性があります'
      },
      {
        title: '3. 高ビットレート素材の注意点',
        warning: {
          title: '⚠️ 高ビットレートとは？',
          desc: '短い動画なのにファイルサイズが大きい場合は「高ビットレート」です。',
          example: '例：4秒で16MB → 高ビットレート（4MB/秒）'
        },
        bitrateTable: {
          headers: ['素材', '10分', '30分', '画質'],
          rows: [
            ['通常（1MB/秒以下）', '◎', '◎', '劣化なし'],
            ['高（2-3MB/秒）', '◎', '○', '若干劣化'],
            ['非常に高（4MB/秒以上）', '○', '△', '圧縮による劣化あり'],
          ]
        },
        note: '高ビットレート素材で30分以上を生成すると、自動圧縮により画質が低下します。特に暗い背景や炎などの動きが多い映像で目立ちます。'
      },
      {
        title: '4. ループしやすい素材の特徴',
        good: {
          title: '✅ おすすめ',
          items: [
            '始まりと終わりの画面が似ている',
            'カメラが固定、または一定の動き',
            '雲、水、炎などの自然な繰り返し',
            '背景があまり変化しない',
          ]
        },
        bad: {
          title: '❌ 避けるべき',
          items: [
            '急なシーン切り替え',
            '人物が出入りする',
            'テキストやロゴの表示/非表示',
            '不規則なカメラの動き',
          ]
        }
      },
      {
        title: '5. おすすめの元素材例',
        examples: [
          { icon: '🌊', name: '波・海', desc: '繰り返しの動きが自然' },
          { icon: '☁️', name: '雲・空', desc: 'ゆっくりした流れ' },
          { icon: '🔥', name: '炎・焚き火', desc: '不規則でも自然に見える' },
          { icon: '🌲', name: '風景・自然', desc: '木々の揺れなど' },
          { icon: '🌃', name: '都市・夜景', desc: '光の点滅が自然' },
        ]
      }
    ]
  } : {
    title: 'User Guide',
    close: 'Close',
    sections: [
      {
        title: '1. Recommended Source Material',
        items: [
          { icon: '⏱️', label: 'Video Length', value: '3-30 seconds' },
          { icon: '📁', label: 'File Size', value: 'Under 100MB' },
          { icon: '🎬', label: 'Format', value: 'MP4 recommended' },
        ],
        note: 'Shorter videos process faster'
      },
      {
        title: '2. Resolution & Duration Guide',
        table: {
          headers: ['Resolution', 'Max Duration', 'Est. File Size'],
          rows: [
            ['1080p (Full HD)', '60 min', '~1.2GB'],
            ['4K (Ultra HD)', '30 min or less', '~2.4GB'],
          ]
        },
        note: '4K 60min may fail due to browser memory limits'
      },
      {
        title: '3. High Bitrate Source Warning',
        warning: {
          title: '⚠️ What is High Bitrate?',
          desc: 'If a short video has a large file size, it\'s "high bitrate".',
          example: 'Example: 4 sec / 16MB = High bitrate (4MB/sec)'
        },
        bitrateTable: {
          headers: ['Source', '10 min', '30 min', 'Quality'],
          rows: [
            ['Normal (≤1MB/sec)', '◎', '◎', 'No loss'],
            ['High (2-3MB/sec)', '◎', '○', 'Slight loss'],
            ['Very High (≥4MB/sec)', '○', '△', 'Compressed'],
          ]
        },
        note: 'High bitrate sources over 30min will be auto-compressed, causing visible quality loss, especially in dark backgrounds and fire/motion.'
      },
      {
        title: '4. Best Videos for Looping',
        good: {
          title: '✅ Recommended',
          items: [
            'Start and end frames look similar',
            'Fixed camera or steady movement',
            'Natural repetition (clouds, water, fire)',
            'Minimal background changes',
          ]
        },
        bad: {
          title: '❌ Avoid',
          items: [
            'Sudden scene changes',
            'People entering/exiting',
            'Text/logo appearing/disappearing',
            'Erratic camera movement',
          ]
        }
      },
      {
        title: '5. Great Source Material Examples',
        examples: [
          { icon: '🌊', name: 'Waves/Ocean', desc: 'Natural repetitive motion' },
          { icon: '☁️', name: 'Clouds/Sky', desc: 'Slow flowing movement' },
          { icon: '🔥', name: 'Fire/Campfire', desc: 'Looks natural even with variation' },
          { icon: '🌲', name: 'Nature/Trees', desc: 'Gentle swaying motion' },
          { icon: '🌃', name: 'City/Night', desc: 'Light flickering is natural' },
        ]
      }
    ]
  };

  return (
    <>
      <button className="guide-button" onClick={() => setIsOpen(true)} title={content.title}>
        ?
      </button>

      {isOpen && (
        <div className="guide-overlay" onClick={() => setIsOpen(false)}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="guide-header">
              <h2>{content.title}</h2>
              <button className="guide-close" onClick={() => setIsOpen(false)}>×</button>
            </div>

            <div className="guide-content">
              {content.sections.map((section, idx) => (
                <div key={idx} className="guide-section">
                  <h3>{section.title}</h3>

                  {section.items && (
                    <div className="guide-items">
                      {section.items.map((item, i) => (
                        <div key={i} className="guide-item">
                          <span className="guide-icon">{item.icon}</span>
                          <span className="guide-label">{item.label}</span>
                          <span className="guide-value">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {section.table && (
                    <div className="guide-table-wrapper">
                      <table className="guide-table">
                        <thead>
                          <tr>
                            {section.table.headers.map((h, i) => (
                              <th key={i}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {section.warning && (
                    <div className="guide-warning">
                      <h4>{section.warning.title}</h4>
                      <p>{section.warning.desc}</p>
                      <code>{section.warning.example}</code>
                    </div>
                  )}

                  {section.bitrateTable && (
                    <div className="guide-table-wrapper">
                      <table className="guide-table guide-bitrate-table">
                        <thead>
                          <tr>
                            {section.bitrateTable.headers.map((h, i) => (
                              <th key={i}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.bitrateTable.rows.map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {section.good && section.bad && (
                    <div className="guide-comparison">
                      <div className="guide-good">
                        <h4>{section.good.title}</h4>
                        <ul>
                          {section.good.items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="guide-bad">
                        <h4>{section.bad.title}</h4>
                        <ul>
                          {section.bad.items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {section.examples && (
                    <div className="guide-examples">
                      {section.examples.map((ex, i) => (
                        <div key={i} className="guide-example">
                          <span className="guide-example-icon">{ex.icon}</span>
                          <div className="guide-example-text">
                            <strong>{ex.name}</strong>
                            <span>{ex.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {section.note && (
                    <p className="guide-note">💡 {section.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
