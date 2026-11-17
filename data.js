'use strict';
/* Roteiro base da expedição. As datas aqui são o PLANO ORIGINAL (ISO yyyy-mm-dd).
   Datas reais, km real, hotéis etc. ficam no estado do usuário (app.js). */

const STAGE_GO = "IDA: Rumo ao Fim do Mundo";
const STAGE_BACK = "VOLTA: Parques, Geleiras e Lagos";
const STAGE_PAMPA = "VOLTA: Regresso pelo Pampa";

const TRIP = [
  { id: 1, stage: STAGE_GO, date: "2027-01-23", origin: "Goiânia-GO", dest: "Presidente Prudente-SP", km: 792, time: "10h 40min", country: "🇧🇷 Brasil",
    highlights: "Dia de rodagem.", gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Goi%C3%A2nia,+GO/Presidente+Prudente,+SP/" },
  { id: 2, stage: STAGE_GO, date: "2027-01-24", origin: "Presidente Prudente-SP", dest: "Romelândia-SC", km: 696, time: "9h 50min", country: "🇧🇷 Brasil",
    highlights: "Dia de rodagem para o Sul.", gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Presidente+Prudente,+SP/Romel%C3%A2ndia,+SC/" },
  { id: 3, stage: STAGE_GO, date: "2027-01-25", origin: "Romelândia-SC", dest: "Santana do Livramento-RS / Rivera-URU", km: 658, time: "9h 00min", country: "🇧🇷 ➔ 🇺🇾",
    highlights: "Fazer os procedimentos de Imigração e Aduana no final do dia no Shopping Siñeriz em Rivera-URU, dormir no Uruguai.",
    gasWarning: false, tours: [{ name: "Free Shop Siñeriz (Rivera) - Compras leves", cost: "Variável" }],
    mapUrl: "https://www.google.com/maps/dir/Romel%C3%A2ndia,+SC/Santana+do+Livramento,+RS/" },
  { id: 4, stage: STAGE_GO, date: "2027-01-26", origin: "Santana do Livramento-RS / Rivera-URU", dest: "Colônia de Sacramento-URU", km: 523, time: "6h 30min", country: "🇺🇾 Uruguai",
    highlights: "Atravessar o Uruguai de norte a sul, pegando o Buquebus ao final do dia em Colônia de Sacramento e atravessando o Rio da Prata até Buenos Aires-ARG.",
    gasWarning: false,
    tours: [
      { name: "Centro Histórico de Colônia (Patrimônio UNESCO)", cost: "Grátis" },
      { name: "Travessia Buquebus c/ Moto (Colônia ➔ Buenos Aires)", cost: "USD 80 - 120" }
    ],
    mapUrl: "https://www.google.com/maps/dir/Rivera,+Uruguai/Colonia+del+Sacramento,+Uruguai/" },
  { id: 5, stage: STAGE_GO, date: "2027-01-27", origin: "Buenos Aires-ARG", dest: "Bahia Blanca-ARG", km: 837, time: "10h 30min", country: "🇦🇷 Argentina",
    highlights: "Pegue RN14, RN12, RP6, RN3 e RP51.", gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Buenos+Aires,+Argentina/Bah%C3%ADa+Blanca,+Argentina/" },
  { id: 6, stage: STAGE_GO, date: "2027-01-28", origin: "Bahia Blanca-ARG", dest: "Trelew-ARG", km: 720, time: "8h 00min", country: "🇦🇷 Argentina",
    highlights: "Entrada na Patagônia após o Rio Colorado. Começa a esfriar, Trelew é a cidade onde foi encontrado o fóssil do maior dinossauro do mundo.",
    gasWarning: false, tours: [{ name: "Museu Paleontológico Egidio Feruglio (MEF)", cost: "USD 10 - 15" }],
    mapUrl: "https://www.google.com/maps/dir/Bah%C3%ADa+Blanca,+Argentina/Trelew,+Argentina/" },
  { id: 7, stage: STAGE_GO, date: "2027-01-29", origin: "Trelew-ARG", dest: "Puerto San Julian-ARG", km: 800, time: "9h 10min", country: "🇦🇷 Argentina",
    highlights: "RN 3, estrada com buracos, guanacos e frio. Em Puerto San Julian está a Réplica da Nao Victoria de Fernão de Magalhães.",
    gasWarning: true, tours: [{ name: "Réplica da Nao Victoria (Fernão de Magalhães)", cost: "USD 5" }],
    mapUrl: "https://www.google.com/maps/dir/Trelew,+Argentina/Puerto+San+Juli%C3%A1n,+Argentina/" },
  { id: 8, stage: STAGE_GO, date: "2027-01-30", origin: "Puerto San Julian-ARG", dest: "Cerro Sombrero-CHL", km: 520, time: "6h 30min", country: "🇦🇷 ➔ 🇨🇱",
    highlights: "DIA DE FRONTEIRA, vento Patagônico e Estreito de Magalhães. Aduana Paso Integração Austral (~70 km após Río Gallegos). Guardar documento PDI para entregar na saída do Chile.",
    gasWarning: true, tours: [{ name: "Balsa Estreito de Magalhães (Punta Delgada)", cost: "USD 10" }],
    mapUrl: "https://www.google.com/maps/dir/Puerto+San+Juli%C3%A1n,+Argentina/Cerro+Sombrero,+Chile/" },
  { id: 9, stage: STAGE_GO, date: "2027-01-31", origin: "Cerro Sombrero-CHL", dest: "Ushuaia-ARG", km: 420, time: "5h 10min", country: "🇨🇱 ➔ 🇦🇷",
    highlights: "Sair do CHL e reentrar na ARG pelo Paso San Sebastián. Restaurante Las Cotorras antes de Ushuaia. Final da RN 3 em Bahía Lapataia, foto na placa!",
    gasWarning: true,
    tours: [
      { name: "Parque Nacional Tierra del Fuego (Bahía Lapataia)", cost: "USD 15 - 20" },
      { name: "Foto na Placa Fin del Mundo", cost: "Grátis" }
    ],
    mapUrl: "https://www.google.com/maps/dir/Cerro+Sombrero,+Chile/Ushuaia,+Argentina/" },
  { id: 10, stage: STAGE_GO, date: "2027-02-01", origin: "Ushuaia-ARG", dest: "Turismo em Ushuaia", km: 0, time: "-", country: "🇦🇷 Terra do Fogo",
    highlights: "Turismo a planejar em Ushuaia.", gasWarning: false,
    tours: [
      { name: "Navegação no Canal Beagle (Farol Les Eclaireurs)", cost: "USD 40 - 50" },
      { name: "Trem do Fim do Mundo", cost: "USD 35 - 45" }
    ],
    mapUrl: "https://www.google.com/maps/search/Ushuaia/" },
  { id: 11, stage: STAGE_GO, date: "2027-02-02", origin: "Ushuaia-ARG", dest: "Turismo em Ushuaia", km: 0, time: "-", country: "🇦🇷 Terra do Fogo",
    highlights: "Turismo a planejar em Ushuaia.", gasWarning: false,
    tours: [
      { name: "Subida ao Glaciar Martial ou Cerro Castor", cost: "USD 10" },
      { name: "Museu Marítimo e Presídio de Ushuaia", cost: "USD 15" }
    ],
    mapUrl: "https://www.google.com/maps/search/Ushuaia/" },

  { id: 12, stage: STAGE_BACK, date: "2027-02-03", origin: "Ushuaia-ARG", dest: "Puerto Natales-CHL", km: 776, time: "10h 00min", country: "🇦🇷 ➔ 🇨🇱",
    highlights: "Paso San Sebastián, saída da ARG e entrada no CHL. Travessia do Estreito de Magalhães (guardar PDI).",
    gasWarning: true, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Ushuaia,+Argentina/Puerto+Natales,+Chile/" },
  { id: 13, stage: STAGE_BACK, date: "2027-02-04", origin: "Puerto Natales-CHL", dest: "Parque Torre del Paine-CHL", km: 85, time: "1h 30min", country: "🇨🇱 Chile",
    highlights: "Chegar no Parque através da Y-290. Hospedar no parque e fazer turismo. Trechos tranquilos de rípio.",
    gasWarning: false,
    tours: [
      { name: "Entrada Parque Nacional Torres del Paine", cost: "USD 35 - 40" },
      { name: "Mirador Cuernos / Salto Grande", cost: "Grátis" }
    ],
    mapUrl: "https://www.google.com/maps/dir/Puerto+Natales,+Chile/Torres+del+Paine,+Chile/" },
  { id: 14, stage: STAGE_BACK, date: "2027-02-05", origin: "Parque Torre del Paine-CHL", dest: "El Calafate + Glaciar Perito Moreno", km: 364, time: "5h 40min", country: "🇨🇱 ➔ 🇦🇷",
    highlights: "Trechos tranquilos de rípio (Y-290 e Y-200). Fronteira pelo Paso Internacional Don Guillermo em Cerro Castillo. Entrada na Ruta 40, visitar o Glaciar Perito Moreno e dormir em El Calafate.",
    gasWarning: false,
    tours: [
      { name: "Parque Nac. Los Glaciares (Glaciar Perito Moreno)", cost: "USD 15 - 30" },
      { name: "Passarelas do Glaciar", cost: "Incluso" }
    ],
    mapUrl: "https://www.google.com/maps/dir/Torres+del+Paine,+Chile/El+Calafate,+Argentina/" },
  { id: 15, stage: STAGE_BACK, date: "2027-02-06", origin: "El Calafate-ARG", dest: "El Chaltén-ARG", km: 213, time: "2h 50min", country: "🇦🇷 Argentina",
    highlights: "El Chaltén, capital do trekking. Vista do imponente Monte Fitz Roy.",
    gasWarning: false, tours: [{ name: "Trekking Mirador Fitz Roy / Laguna Capri", cost: "Grátis" }],
    mapUrl: "https://www.google.com/maps/dir/El+Calafate,+Argentina/El+Chalt%C3%A9n,+Argentina/" },
  { id: 16, stage: STAGE_BACK, date: "2027-02-07", origin: "El Chaltén-ARG", dest: "Perito Moreno-ARG", km: 665, time: "8h 10min", country: "🇦🇷 Ruta 40",
    highlights: "Dia dos 73 malditos. Seguir em direção a Gobernador Gregores (evitar desvio ruim à esquerda). Vários trechos de cascalho na Ruta 40 e famoso posto YPF Bajo Caracoles.",
    gasWarning: true, tours: [{ name: "Cueva de las Manos (Desvio opcional na R40)", cost: "USD 10" }],
    mapUrl: "https://www.google.com/maps/dir/El+Chalt%C3%A9n,+Argentina/Perito+Moreno,+Santa+Cruz,+Argentina/" },
  { id: 17, stage: STAGE_BACK, date: "2027-02-08", origin: "Perito Moreno-ARG", dest: "Bariloche-ARG", km: 800, time: "9h 50min", country: "🇦🇷 Argentina",
    highlights: "Via RN 40: saída da Província de Santa Cruz, atravessando Chubut até chegar à Província de Río Negro (Bariloche).",
    gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Perito+Moreno,+Santa+Cruz,+Argentina/San+Carlos+de+Bariloche,+Argentina/" },
  { id: 18, stage: STAGE_BACK, date: "2027-02-09", origin: "Bariloche-ARG", dest: "Turismo em Bariloche", km: 0, time: "-", country: "🇦🇷 Argentina",
    highlights: "Turismo a planejar em Bariloche.", gasWarning: false,
    tours: [
      { name: "Circuito Chico de Moto (Rota Cênica)", cost: "Combustível" },
      { name: "Cerro Campanário (Teleférico vista 360º)", cost: "USD 12 - 15" }
    ],
    mapUrl: "https://www.google.com/maps/search/San+Carlos+de+Bariloche/" },
  { id: 19, stage: STAGE_PAMPA, date: "2027-02-10", origin: "Bariloche-ARG", dest: "Zapala-ARG", km: 435, time: "6h 13min", country: "🇦🇷 Argentina",
    highlights: "Rota dos 7 Lagos pela Ruta 40 (108 km entre Villa La Angostura e San Martín de los Andes, uma das estradas mais bonitas do mundo).",
    gasWarning: false, tours: [{ name: "Mirantes da Rota dos 7 Lagos", cost: "Grátis" }],
    mapUrl: "https://www.google.com/maps/dir/San+Carlos+de+Bariloche,+Argentina/Zapala,+Argentina/" },
  { id: 20, stage: STAGE_PAMPA, date: "2027-02-11", origin: "Zapala-ARG", dest: "Trenque Lauquen-ARG", km: 894, time: "11h 30min", country: "🇦🇷 Argentina",
    highlights: "Patagônia, frio e Cordilheira dos Andes ficando para trás. Retorno, dia de rodagem.",
    gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Zapala,+Argentina/Trenque+Lauquen,+Argentina/" },
  { id: 21, stage: STAGE_PAMPA, date: "2027-02-12", origin: "Trenque Lauquen-ARG", dest: "Concórdia-ARG", km: 780, time: "9h 00min", country: "🇦🇷 Argentina",
    highlights: "Retorno, dia de rodagem.", gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Trenque+Lauquen,+Argentina/Concordia,+Entre+R%C3%ADos,+Argentina/" },
  { id: 22, stage: STAGE_PAMPA, date: "2027-02-13", origin: "Concórdia-ARG", dest: "Foz do Iguaçu-BRA", km: 876, time: "11h 20min", country: "🇦🇷 ➔ 🇧🇷",
    highlights: "Retorno, dia de rodagem e reentrada no Brasil.", gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Concordia,+Entre+R%C3%ADos,+Argentina/Foz+do+Igua%C3%A7u,+PR/" },
  { id: 23, stage: STAGE_PAMPA, date: "2027-02-14", origin: "Foz do Iguaçu-PR", dest: "Presidente Prudente-SP", km: 580, time: "7h 30min", country: "🇧🇷 Brasil",
    highlights: "Retorno, dia de rodagem.", gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Foz+do+Igua%C3%A7u,+PR/Presidente+Prudente,+SP/" },
  { id: 24, stage: STAGE_PAMPA, date: "2027-02-15", origin: "Presidente Prudente-SP", dest: "Goiânia-GO", km: 792, time: "10h 40min", country: "🇧🇷 Brasil",
    highlights: "Retorno, dia de rodagem. Chegada em casa!", gasWarning: false, tours: [],
    mapUrl: "https://www.google.com/maps/dir/Presidente+Prudente,+SP/Goi%C3%A2nia,+GO/" }
];

/* Checklists. perPerson=true → cada integrante do grupo marca o seu. */
const LISTS = [
  { id: "docs", title: "Documentação, Câmbio & Seguros (BR / AR / CL / UY)", perPerson: true, items: [
    { id: "d1", t: "<strong>Seguro Carta Verde (impresso):</strong> cobertura obrigatória para terceiros no Mercosul (Argentina e Uruguai), uma para cada moto." },
    { id: "d2", t: "<strong>Seguro SOAPEX (impresso):</strong> seguro obrigatório exclusivo para circular no Chile, uma para cada moto." },
    { id: "d3", t: "<strong>Seguro viagem pessoal:</strong> emitir pelo cartão (se a passagem for paga com ele) ou contratar um com cobertura para motociclismo." },
    { id: "d4", t: "<strong>Cartão internacional (ex.: Nomad):</strong> débito com IOF reduzido para postos, pedágios e hotéis." },
    { id: "d5", t: "<strong>Dólar em espécie (reserva de segurança):</strong> sugestão de USD 1.000 a 1.500 por pessoa (notas novas de 100 'cara grande' ou azuis) para câmbio e emergências." },
    { id: "d6", t: "<strong>Passagens Buquebus (Colônia ⇄ Buenos Aires):</strong> emitir bilhetes (motos + pilotos) e reservar dólares para taxas portuárias." },
    { id: "d7", t: "<strong>Documentos básicos:</strong> passaporte válido (ou RG com menos de 10 anos), CRLV-e impresso, PID + CNH física." }
  ]},
  { id: "personal", title: "Checklist Pessoal & Bagagem", perPerson: true, items: [
    { id: "p1", t: "<strong>Vestuário de frio extremo:</strong> segunda pele térmica de alta gramatura, balaclava e meias de lã merino." },
    { id: "p2", t: "<strong>Conjunto impermeável (capa de chuva):</strong> de fácil acesso no baú para mudanças bruscas de clima." },
    { id: "p3", t: "<strong>Luvas:</strong> 1 par de inverno/impermeável e 1 par de verão/meia estação." },
    { id: "p4", t: "<strong>Hidratação:</strong> mochila de hidratação (Camelbak) para beber água em movimento." },
    { id: "p5", t: "<strong>Óculos de sol e viseira:</strong> viseira cristal limpa para pilotagem noturna/chuva + óculos escuros." },
    { id: "p6", t: "<strong>Kit higiene & farmácia:</strong> remédios pessoais, protetor labial, protetor solar e colírio." }
  ]},
  { id: "moto", title: "Preparação Mecânica & Pneus (cada moto)", perPerson: true, items: [
    { id: "m1", t: "<strong>Pneus Mitas 50/50 zero km (BMW F 850 GS 2023):</strong> Mitas E-07+ (Enduro Trail+) — dianteiro <strong>90/90-21 54T TL</strong> e traseiro <strong>150/70B17 69T TL</strong>." },
    { id: "m2", t: "<strong>1 litro de óleo na bagagem:</strong> BMW Motorrad ADVANTEC Ultimate 5W-40 (API SN / JASO MA2) ou Motul 7100 5W-40 4T." },
    { id: "m3", t: "<strong>Galão de gasolina auxiliar (5L a 10L):</strong> homologado e cheio nos trechos da Ruta 3 e Ruta 40 ('73 malditos')." },
    { id: "m4", t: "<strong>Lubrificação diária de corrente:</strong> Motul C4 Chain Lube Factory Line + escova/limpador ao fim de cada dia." },
    { id: "m5", t: "<strong>Kit reparo de pneus (tubeless):</strong> macarrão, escareador, válvulas extras + mini compressor 12V portátil." },
    { id: "m6", t: "<strong>Manutenção de emergência:</strong> silver tape, abraçadeiras de nylon, durepoxi e jogo de chaves Torx BMW." },
    { id: "m7", t: "<strong>Itens exigidos em fronteira:</strong> cinta/cambão de reboque, kit primeiros socorros e colete refletivo." }
  ]},
  { id: "border", title: "Fronteiras (grupo) — confira horários e exigências antes de viajar", perPerson: false, items: [
    { id: "b1", t: "<strong>Dia 3 • Rivera (BR ➔ UY):</strong> imigração e aduana no Shopping Siñeriz. Carimbos de pessoas e documento de entrada das motos." },
    { id: "b2", t: "<strong>Dia 4 • Colônia ➔ Buenos Aires (UY ➔ AR):</strong> conferir no embarque do Buquebus os papéis de pessoas e motos (migração/aduana)." },
    { id: "b3", t: "<strong>Dia 8 • Paso Integración Austral (AR ➔ CL):</strong> guardar o documento PDI/importação temporária das motos para entregar na saída do Chile." },
    { id: "b4", t: "<strong>Dia 9 • Paso San Sebastián (CL ➔ AR):</strong> entregar o documento do Chile e refazer a entrada na Argentina." },
    { id: "b5", t: "<strong>Dia 12 • Paso San Sebastián (AR ➔ CL):</strong> nova entrada no Chile (guardar o PDI novamente)." },
    { id: "b6", t: "<strong>Dia 14 • Paso Don Guillermo / Cerro Castillo (CL ➔ AR):</strong> saída do Chile e entrada na Argentina rumo a El Calafate." },
    { id: "b7", t: "<strong>Dia 22 • Retorno ao Brasil (AR ➔ BR):</strong> conferir saída das motos da Argentina e entrada no Brasil." }
  ]}
];
