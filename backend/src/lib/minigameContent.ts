// Contenido inicial de los minijuegos. Las trivias se cargan a la tabla
// trivia_questions la primera vez (si esa categoría está vacía) y después los
// capitanes pueden agregar/editar/borrar desde la página. La primera opción
// de cada pregunta es la correcta; el orden se mezcla al armar el reto.

export interface SeedQuestion {
  question: string
  options: [string, string, string, string]
  explanation?: string
}

export const TRIVIA_CATEGORIES = ['futbol', 'osm', 'competencias'] as const
export type TriviaCategory = (typeof TRIVIA_CATEGORIES)[number]

export const FUTBOL_QUESTIONS: SeedQuestion[] = [
  { question: '¿Qué selección ganó el Mundial de Qatar 2022?', options: ['Argentina', 'Francia', 'Croacia', 'Marruecos'] },
  { question: '¿Qué selección perdió la final del Mundial 2022?', options: ['Francia', 'Croacia', 'Marruecos', 'Brasil'] },
  { question: '¿Qué selección ganó el Mundial de Rusia 2018?', options: ['Francia', 'Croacia', 'Bélgica', 'Inglaterra'] },
  { question: '¿Qué selección ganó el Mundial de Brasil 2014?', options: ['Alemania', 'Argentina', 'Países Bajos', 'Brasil'] },
  { question: '¿Qué selección ganó el Mundial de Sudáfrica 2010?', options: ['España', 'Países Bajos', 'Alemania', 'Uruguay'] },
  { question: '¿Qué selección ganó el Mundial de Alemania 2006?', options: ['Italia', 'Francia', 'Alemania', 'Portugal'] },
  { question: '¿Qué selección ganó el Mundial de Corea-Japón 2002?', options: ['Brasil', 'Alemania', 'Turquía', 'Corea del Sur'] },
  { question: '¿Qué selección ganó el Mundial de Francia 1998?', options: ['Francia', 'Brasil', 'Croacia', 'Países Bajos'] },
  { question: '¿Qué selección ganó el Mundial de México 1986?', options: ['Argentina', 'Alemania', 'Francia', 'Brasil'] },
  { question: '¿Qué país ganó más Copas del Mundo?', options: ['Brasil', 'Alemania', 'Italia', 'Argentina'], explanation: 'Brasil tiene 5 títulos mundiales.' },
  { question: '¿En qué año se jugó el primer Mundial?', options: ['1930', '1934', '1950', '1926'] },
  { question: '¿Qué país organizó y ganó el primer Mundial?', options: ['Uruguay', 'Italia', 'Brasil', 'Argentina'] },
  { question: '¿Quién es el máximo goleador en la historia de los Mundiales?', options: ['Kylian Mbappé', 'Lionel Messi', 'Miroslav Klose', 'Ronaldo Nazário'], explanation: 'Mbappé llegó a 22 goles en el Mundial 2026 y superó a Messi (21) y a Klose (16).' },
  { question: '¿Qué selección ganó el Mundial 2026?', options: ['España', 'Argentina', 'Inglaterra', 'Francia'], explanation: 'España le ganó 1-0 a Argentina en la final, en tiempo extra. Es su segundo título.' },
  { question: '¿Qué selección perdió la final del Mundial 2026?', options: ['Argentina', 'Francia', 'Inglaterra', 'Brasil'], explanation: 'Perdió 1-0 con España en tiempo extra.' },
  { question: '¿Quién hizo el gol de España en la final del Mundial 2026?', options: ['Ferran Torres', 'Lamine Yamal', 'Mikel Oyarzabal', 'Dani Olmo'], explanation: 'Lo marcó en el minuto 106, en el tiempo extra.' },
  { question: '¿Qué selección terminó tercera en el Mundial 2026?', options: ['Inglaterra', 'Francia', 'Brasil', 'Portugal'], explanation: 'Inglaterra le ganó el partido por el tercer puesto a Francia.' },
  { question: '¿Quién ganó la Bota de Oro (goleador) del Mundial 2026?', options: ['Kylian Mbappé', 'Lionel Messi', 'Erling Haaland', 'Jude Bellingham'], explanation: 'Mbappé hizo 10 goles; Messi, 8.' },
  { question: '¿Cuántos Mundiales ganó España?', options: ['2', '1', '3', '4'], explanation: 'Sudáfrica 2010 y Norteamérica 2026.' },
  { question: '¿Qué países organizaron el Mundial 2026?', options: ['Estados Unidos, México y Canadá', 'Estados Unidos y México', 'España, Portugal y Marruecos', 'Arabia Saudita'] },
  { question: '¿Cuántas selecciones jugaron el Mundial 2026?', options: ['48', '32', '40', '64'] },
  { question: '¿Quién marcó el gol conocido como "La Mano de Dios"?', options: ['Diego Maradona', 'Pelé', 'Mario Kempes', 'Gabriel Batistuta'] },
  { question: '¿Cuántos Balones de Oro ganó Lionel Messi?', options: ['8', '7', '6', '5'] },
  { question: '¿Quién ganó el Balón de Oro 2018?', options: ['Luka Modrić', 'Cristiano Ronaldo', 'Lionel Messi', 'Kylian Mbappé'] },
  { question: '¿Qué jugador hizo 91 goles en el año 2012, récord en un año calendario?', options: ['Lionel Messi', 'Cristiano Ronaldo', 'Gerd Müller', 'Robert Lewandowski'] },
  { question: '¿Qué club tiene más Champions League / Copas de Europa?', options: ['Real Madrid', 'AC Milan', 'Bayern Múnich', 'Liverpool'] },
  { question: '¿Qué club ganó la Champions League 2023?', options: ['Manchester City', 'Inter de Milán', 'Real Madrid', 'Bayern Múnich'] },
  { question: '¿Qué club ganó la Champions League 2024?', options: ['Real Madrid', 'Borussia Dortmund', 'Bayern Múnich', 'PSG'] },
  { question: '¿Qué club ganó la Champions League 2025?', options: ['PSG', 'Inter de Milán', 'Barcelona', 'Arsenal'], explanation: 'El PSG le ganó 5-0 al Inter en la final.' },
  { question: '¿Qué club ganó la Champions League 2026?', options: ['PSG', 'Arsenal', 'Real Madrid', 'Bayern Múnich'], explanation: 'Le ganó al Arsenal por penales (1-1 en el partido) y fue bicampeón de Europa.' },
  { question: '¿Qué club ganó el Mundial de Clubes 2025 (el primero con 32 equipos)?', options: ['Chelsea', 'PSG', 'Real Madrid', 'Manchester City'] },
  { question: '¿Qué selección ganó la Eurocopa 2024?', options: ['España', 'Inglaterra', 'Francia', 'Países Bajos'] },
  { question: '¿Qué selección ganó la Eurocopa 2020 (jugada en 2021)?', options: ['Italia', 'Inglaterra', 'España', 'Dinamarca'] },
  { question: '¿Qué selección ganó la Copa América 2021?', options: ['Argentina', 'Brasil', 'Colombia', 'Perú'] },
  { question: '¿Qué selección ganó la Copa América 2024?', options: ['Argentina', 'Colombia', 'Uruguay', 'Canadá'] },
  { question: '¿En qué club debutó Lionel Messi como profesional?', options: ['Barcelona', "Newell's Old Boys", 'PSG', 'River Plate'] },
  { question: '¿De qué país es Luka Modrić?', options: ['Croacia', 'Serbia', 'Eslovenia', 'Bosnia'] },
  { question: '¿De qué país es Erling Haaland?', options: ['Noruega', 'Suecia', 'Dinamarca', 'Islandia'] },
  { question: '¿De qué país es Mohamed Salah?', options: ['Egipto', 'Marruecos', 'Argelia', 'Túnez'] },
  { question: '¿De qué país es Kylian Mbappé?', options: ['Francia', 'Bélgica', 'Camerún', 'Suiza'] },
  { question: '¿Qué jugador es conocido como "CR7"?', options: ['Cristiano Ronaldo', 'Ronaldo Nazário', 'Ronaldinho', 'Cristian Romero'] },
  { question: '¿Qué selección es conocida como "La Albiceleste"?', options: ['Argentina', 'Uruguay', 'Chile', 'Paraguay'] },
  { question: '¿Qué selección es conocida como "La Celeste"?', options: ['Uruguay', 'Argentina', 'Italia', 'Honduras'] },
  { question: '¿Cómo se llama el estadio del Real Madrid?', options: ['Santiago Bernabéu', 'Camp Nou', 'Metropolitano', 'Mestalla'] },
  { question: '¿Cómo se llama el estadio del Barcelona?', options: ['Camp Nou', 'Santiago Bernabéu', 'San Mamés', 'Benito Villamarín'] },
  { question: '¿En qué ciudad juega el Bayern?', options: ['Múnich', 'Berlín', 'Dortmund', 'Hamburgo'] },
  { question: '¿Qué club inglés es conocido como "Los Diablos Rojos"?', options: ['Manchester United', 'Liverpool', 'Arsenal', 'Nottingham Forest'] },
  { question: '¿Cuántos jugadores tiene cada equipo en cancha?', options: ['11', '10', '12', '9'] },
  { question: '¿Cuánto dura un partido reglamentario, sin el tiempo de descuento?', options: ['90 minutos', '80 minutos', '100 minutos', '120 minutos'] },
  { question: '¿Desde qué distancia se patea un penal?', options: ['11 metros', '9 metros', '12 metros', '16,5 metros'] },
  { question: '¿Qué tarjeta significa expulsión directa?', options: ['Roja', 'Amarilla', 'Verde', 'Azul'] },
]

// Datos tomados del calendario oficial de eventos que cargó el clan
// (septiembre y octubre 2026), así que son fieles a lo que pasa en el juego.
export const OSM_QUESTIONS: SeedQuestion[] = [
  { question: '¿Qué empresa desarrolla Online Soccer Manager?', options: ['Gamebasics', 'EA Sports', 'Konami', 'Sports Interactive'] },
  { question: 'Sin eventos activos, ¿cuánto tarda normalmente el ojeador?', options: ['16 horas', '8 horas', '4 horas', '24 horas'] },
  { question: 'Durante el evento "Ojeador de Gangas", ¿cuánto tarda el ojeador?', options: ['2 horas', '16 horas', '6 horas', '30 minutos'] },
  { question: 'Durante "Estadio Relámpago", ¿cuánto tardan las mejoras del estadio?', options: ['4 horas', '2 horas', '8 horas', '12 horas'] },
  { question: 'En "Locura de Transferencias", ¿hasta cuántos jugadores podés poner en la lista de transferencias?', options: ['6', '4', '8', '10'] },
  { question: 'En "Personal Súper Rápido", ¿cuánto tarda el analista en entregar un informe?', options: ['15 minutos', '1 hora', '30 minutos', '2 horas'] },
  { question: 'En "Personal Súper Rápido", ¿cuánto tardan el Doctor y el Abogado?', options: ['3 horas', '1 hora', '6 horas', '12 horas'] },
  { question: 'En "Entrenamiento Extremo", ¿cuánto tarda el Entrenador Universal?', options: ['2 horas', '3 horas', '1 hora', '4 horas'] },
  { question: 'El evento "Golden Oldies" da más progreso de entrenamiento a...', options: ['Jugadores veteranos', 'Jugadores jóvenes', 'Arqueros', 'Delanteros'] },
  { question: 'En "Talentos en Entrenamiento", ¿hasta qué edad se considera joven?', options: ['24 años', '21 años', '23 años', '19 años'] },
  { question: '¿Qué evento agrega jugadores Leyenda a la lista de transferencias?', options: ['Leyendas', 'Ojeador de Gangas', 'Amistosos Intensos', 'Estadio Relámpago'] },
  { question: '¿Qué evento da progreso de entrenamiento extra con cada partido amistoso?', options: ['Amistosos Intensos', 'Instalaciones de Primera', 'Ojeador de Gangas', 'Leyendas'] },
]

// Palabras de 5 letras para el Wordle futbolero (sin tildes). La pista
// sale debajo del tablero para que no sea imposible.
export const WORDLE_WORDS: Array<{ word: string; hint: string }> = [
  { word: 'MESSI', hint: 'Delantero argentino' },
  { word: 'PIRLO', hint: 'Mediocampista italiano' },
  { word: 'KROOS', hint: 'Mediocampista alemán' },
  { word: 'SALAH', hint: 'Delantero egipcio' },
  { word: 'PUYOL', hint: 'Defensor español' },
  { word: 'RAMOS', hint: 'Defensor español' },
  { word: 'PIQUE', hint: 'Defensor español' },
  { word: 'VIDAL', hint: 'Mediocampista chileno' },
  { word: 'ALVES', hint: 'Lateral brasileño' },
  { word: 'NESTA', hint: 'Defensor italiano' },
  { word: 'TOTTI', hint: 'Delantero italiano' },
  { word: 'KANTE', hint: 'Mediocampista francés' },
  { word: 'PEDRI', hint: 'Mediocampista español' },
  { word: 'YAMAL', hint: 'Extremo español' },
  { word: 'VIERI', hint: 'Delantero italiano' },
  { word: 'SUKER', hint: 'Delantero croata' },
  { word: 'HENRY', hint: 'Delantero francés' },
  { word: 'VILLA', hint: 'Delantero español' },
  { word: 'RODRI', hint: 'Mediocampista español' },
  { word: 'KEANE', hint: 'Mediocampista irlandés' },
  { word: 'TERRY', hint: 'Defensor inglés' },
  { word: 'KLOSE', hint: 'Delantero alemán' },
  { word: 'NEUER', hint: 'Portero alemán' },
  { word: 'POGBA', hint: 'Mediocampista francés' },
  { word: 'PAYET', hint: 'Mediocampista francés' },
  { word: 'SILVA', hint: 'Mediocampista español (David)' },
  { word: 'NAVAS', hint: 'Portero costarricense' },
  { word: 'OCHOA', hint: 'Portero mexicano' },
  { word: 'TEVEZ', hint: 'Delantero argentino' },
  { word: 'AIMAR', hint: 'Mediocampista argentino' },
  { word: 'DUNGA', hint: 'Mediocampista brasileño' },
  { word: 'DEPAY', hint: 'Delantero neerlandés' },
  { word: 'GAKPO', hint: 'Extremo neerlandés' },
  { word: 'FODEN', hint: 'Mediocampista inglés' },
  { word: 'WIRTZ', hint: 'Mediocampista alemán' },
  { word: 'YEPES', hint: 'Defensor colombiano' },
  { word: 'SALAS', hint: 'Delantero chileno' },
  { word: 'COSTA', hint: 'Delantero (Diego), jugó con España' },
  { word: 'JAMES', hint: 'Mediocampista colombiano' },
  { word: 'LUCIO', hint: 'Defensor brasileño' },
  { word: 'GOTZE', hint: 'Mediocampista alemán' },
  { word: 'DZEKO', hint: 'Delantero bosnio' },
  { word: 'HONDA', hint: 'Mediocampista japonés' },
]
