import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  Animated,
  Vibration,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { programas } from "./src/questions";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [programa, setPrograma] = useState(null);
  const [livroSelecionado, setLivroSelecionado] = useState(null);
  const [indice, setIndice] = useState(0);
  const [tentativa, setTentativa] = useState(1);
  const [pontos, setPontos] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [nome, setNome] = useState("");
  const [tempo, setTempo] = useState(0);
  const [travado, setTravado] = useState(false);
  const [bonusPopup, setBonusPopup] = useState("");
  const [ranking, setRanking] = useState([]);
  const [perguntasQuiz, setPerguntasQuiz] = useState([]);

  const bonusAnim = useRef(new Animated.Value(0)).current;
  const wrongAnim = useRef(new Animated.Value(0)).current;

  const maximo = useMemo(() => (perguntasQuiz.length || programa?.questions?.length || 0) * 13, [perguntasQuiz.length, programa]);
  const tempoLimite = 35;
  const tempoRestante = Math.max(0, tempoLimite - tempo);
  const porcentagemTempo = Math.max(0, (tempoRestante / tempoLimite) * 100);
  const livrosDisponiveis = [
    {
      id: "esportes",
      title: "Pense Bem Esportes",
      subtitle: "Olimpíadas, futebol, natação, tênis, atletismo e mais",
      code: "Livro 04",
      icon: "🏆",
      programas,
    },
  ];
  const programasDoLivro = livroSelecionado?.programas || [];
  const programasComPerguntas = programasDoLivro.filter((p) => p.questions.length > 0);

  useEffect(() => {
    carregarRanking();
  }, []);

  function embaralharArray(array) {
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  function embaralharAlternativas(pergunta) {
    const alternativas = pergunta.options.map((texto, index) => ({
      texto,
      correta: index === pergunta.answer,
    }));

    const alternativasMisturadas = embaralharArray(alternativas);

    return {
      ...pergunta,
      options: alternativasMisturadas.map((item) => item.texto),
      answer: alternativasMisturadas.findIndex((item) => item.correta),
    };
  }

  async function carregarRanking() {
    try {
      const salvo = await AsyncStorage.getItem("ranking-pense-bem");
      if (salvo) {
        setRanking(JSON.parse(salvo));
      }
    } catch (error) {
      console.log("Ranking não carregado:", error?.message);
    }
  }

  async function salvarRanking(pontuacaoFinal) {
    const novoRegistro = {
      id: Date.now().toString(),
      nome: (nome || "PLAYER01").trim(),
      pontos: pontuacaoFinal,
      livro: livroSelecionado?.title || "Livro",
      programa: programa?.title || "Programa",
      data: new Date().toLocaleDateString("pt-BR"),
    };

    try {
      const atualizado = [novoRegistro, ...ranking]
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 10);
      setRanking(atualizado);
      await AsyncStorage.setItem("ranking-pense-bem", JSON.stringify(atualizado));
    } catch (error) {
      console.log("Ranking não salvo:", error?.message);
    }
  }

  useEffect(() => {
    if (screen !== "quiz" || travado) return;

    const intervalo = setInterval(() => {
      setTempo((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(intervalo);
  }, [screen, indice, travado]);

  useEffect(() => {
    if (screen !== "quiz" || travado) return;

    if (tempoRestante > 0 && tempoRestante <= 10) {
      tocarContagem();
    }
  }, [tempoRestante, screen, travado]);

  useEffect(() => {
    if (screen !== "quiz" || travado) return;

    if (tempo >= tempoLimite) {
      setTravado(true);
      setFeedback("TEMPO ESGOTADO! Próxima pergunta...");
      animarErro();
      setTimeout(() => proximaPergunta(pontos), 900);
    }
  }, [tempo, screen, travado]);

  function tocarContagem() {
    Vibration.vibrate(35);
  }

  function calcularBonusVelocidade(segundos) {
    return segundos <= 10 ? 10 : 0;
  }

  function mostrarBonus(valor) {
    if (valor <= 0) return;

    setBonusPopup(`+${valor} BÔNUS ⚡`);
    bonusAnim.setValue(0);

    Animated.sequence([
      Animated.spring(bonusAnim, {
        toValue: 1,
        friction: 4,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.delay(550),
      Animated.timing(bonusAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setBonusPopup(""));
  }

  function animarErro() {
    wrongAnim.setValue(0);
    Animated.sequence([
      Animated.timing(wrongAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(wrongAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(wrongAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(wrongAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    Vibration.vibrate(90);
  }

  function selecionarLivro(livro) {
    setLivroSelecionado(livro);
    setScreen("programas");
  }

  function iniciarPrograma(p) {
    const perguntasEmbaralhadas = (p.questions || []).map(embaralharAlternativas);
    setPrograma(p);
    setPerguntasQuiz(perguntasEmbaralhadas);
    setIndice(0);
    setTentativa(1);
    setPontos(0);
    setFeedback("");
    setTempo(0);
    setTravado(false);
    setBonusPopup("");
    setScreen(perguntasEmbaralhadas.length ? "quiz" : "empty");
  }

  function responder(index) {
    if (travado) return;

    const atual = perguntasQuiz[indice];

    if (index === atual.answer) {
      setTravado(true);
      const base = 4 - tentativa;
      const bonus = calcularBonusVelocidade(tempo);
      const ganhos = base + bonus;
      const novoTotal = pontos + ganhos;
      setPontos(novoTotal);
      setFeedback(`ACERTOU! +${base} XP + ${bonus} bônus`);
      mostrarBonus(bonus);
      setTimeout(() => proximaPergunta(novoTotal), 1200);
      return;
    }

    animarErro();

    if (tentativa < 3) {
      setTentativa((prev) => prev + 1);
      setFeedback("ERROU! TENTE DE NOVO.");
    } else {
      setTravado(true);
      setFeedback("SEM PONTOS NESSA!");
      setTimeout(() => proximaPergunta(pontos), 950);
    }
  }

  function proximaPergunta(pontuacaoAtual = pontos) {
    if (indice + 1 < perguntasQuiz.length) {
      setIndice((prev) => prev + 1);
      setTentativa(1);
      setFeedback("");
      setTempo(0);
      setTravado(false);
    } else {
      setTravado(false);
      salvarRanking(pontuacaoAtual);
      setScreen("resultado");
    }
  }

  function voltarInicio() {
    setScreen("home");
    setPrograma(null);
    setLivroSelecionado(null);
    setPerguntasQuiz([]);
    setIndice(0);
    setTentativa(1);
    setPontos(0);
    setFeedback("");
    setTempo(0);
    setTravado(false);
    setBonusPopup("");
  }

  if (screen === "home") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.homeScroll}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.logo}>⚡ PENSE BEM</Text>
              <Text style={styles.logoSub}>ESCOLHA SEU LIVRO</Text>
            </View>
            <View style={styles.profileBox}>
              <Text style={styles.profileName}>{nome || "PLAYER01"}</Text>
              <Text style={styles.profileLevel}>NÍVEL 23</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.tag}>ANTES DE COMEÇAR</Text>
            <Text style={styles.title}>
              QUAL LIVRO{'\n'}
              VOCÊ QUER{'\n'}
              <Text style={styles.green}>JOGAR?</Text>
            </Text>
            <Text style={styles.description}>
              Digite seu nome e escolha um dos livros disponíveis para carregar os programas e perguntas desse tema.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Digite seu nome"
              placeholderTextColor="#80769a"
              value={nome}
              onChangeText={setNome}
            />
          </View>

          <Text style={styles.sectionTitle}>LIVROS DISPONÍVEIS</Text>
          {livrosDisponiveis.map((livro) => {
            const totalPerguntas = livro.programas.reduce((total, p) => total + p.questions.length, 0);
            return (
              <TouchableOpacity key={livro.id} style={styles.bookCard} onPress={() => selecionarLivro(livro)}>
                <Text style={styles.bookIcon}>{livro.icon}</Text>
                <View style={styles.bookInfo}>
                  <Text style={styles.programTitle}>{livro.title}</Text>
                  <Text style={styles.programText}>{livro.subtitle}</Text>
                  <Text style={styles.programText}>{livro.code} • {livro.programas.length} programas • {totalPerguntas} perguntas</Text>
                </View>
                <Text style={styles.programArrow}>›</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.rankCard} onPress={() => setScreen("ranking")}>
            <Text style={styles.trophy}>🏆</Text>
            <View>
              <Text style={styles.rankLabel}>RANKING LOCAL</Text>
              <Text style={styles.rankNumber}>{ranking[0] ? `${ranking[0].pontos} XP` : "0 XP"}</Text>
            </View>
            <Text style={styles.rankLink}>VER RANKING ›</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "programas") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.homeScroll}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.logo}>⚡ PENSE BEM</Text>
              <Text style={styles.logoSub}>{livroSelecionado?.title || "LIVRO"}</Text>
            </View>
            <View style={styles.profileBox}>
              <Text style={styles.profileName}>{nome || "PLAYER01"}</Text>
              <Text style={styles.profileLevel}>NÍVEL 23</Text>
            </View>
          </View>

          <View style={styles.hero}>
           <Text style={styles.tag}>LIVRO SELECIONADO</Text>
          <Text style={styles.title}>
            ESCOLHA UM{' '}
          <Text style={styles.green}>PROGRAMA</Text>
          </Text>
            <Text style={styles.description}>
              {livroSelecionado?.subtitle}. Você pode começar pelo primeiro programa ou escolher um específico abaixo.
            </Text>
            <TouchableOpacity
              style={styles.mainButton}
              onPress={() => iniciarPrograma(programasComPerguntas[0])}
            >
              <Text style={styles.mainButtonText}>COMEÇAR PRIMEIRO QUIZ ›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={voltarInicio}>
              <Text style={styles.secondaryButtonText}>TROCAR LIVRO</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>COMO FUNCIONA</Text>
          <View style={styles.stepsGrid}>
            <InfoCard number="01" title="ESCOLHA UM QUIZ" text="Selecione um programa do livro." icon="🎮" />
            <InfoCard number="02" title="RESPONDA" text="Cada questão tem até 3 tentativas." icon="🎯" />
            <InfoCard number="03" title="GANHE PONTOS" text="Acertou rápido? Ganha mais XP." icon="XP" />
            <InfoCard number="04" title="SUBA NO RANKING" text="Finalize com a maior pontuação." icon="🏆" />
          </View>

          <Text style={styles.sectionTitle}>PROGRAMAS DO LIVRO</Text>
          {programasDoLivro.map((p) => (
            <TouchableOpacity key={p.id} style={styles.programCard} onPress={() => iniciarPrograma(p)}>
              <View>
                <Text style={styles.programTitle}>{p.title}</Text>
                <Text style={styles.programText}>
                  {p.questions.length ? `${p.questions.length} perguntas cadastradas` : "Em cadastro"}
                </Text>
              </View>
              <Text style={styles.programArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "ranking") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.homeScroll}>
          <Text style={styles.logo}>🏆 RANKING</Text>
          <Text style={styles.logoSub}>LOCAL</Text>

          {ranking.length === 0 ? (
            <View style={styles.resultCard}>
              <Text style={styles.descriptionCenter}>Nenhuma partida registrada ainda.</Text>
            </View>
          ) : (
            ranking.map((item, index) => (
              <View key={item.id} style={styles.rankingItem}>
                <Text style={styles.rankingPosition}>#{index + 1}</Text>
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingName}>{item.nome}</Text>
                  <Text style={styles.rankingDate}>{item.data} • {item.livro || "Livro"} • {item.programa}</Text>
                </View>
                <Text style={styles.rankingPoints}>{item.pontos} XP</Text>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.mainButton} onPress={voltarInicio}>
            <Text style={styles.mainButtonText}>VOLTAR ›</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === "empty") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerScreen}>
          <Text style={styles.logo}>⚡ EM CADASTRO</Text>
          <View style={styles.resultCard}>
            <Text style={styles.descriptionCenter}>
              Este programa já está na estrutura do app, mas ainda precisa ter as perguntas cadastradas no arquivo src/questions.js.
            </Text>
          </View>
          <TouchableOpacity style={styles.mainButton} onPress={voltarInicio}>
            <Text style={styles.mainButtonText}>VOLTAR ›</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "resultado") {
    const senha = `${programa.id}${pontos}${maximo}`.padStart(6, "0");
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerScreen}>
          <Text style={styles.logo}>⚡ FIM DE JOGO</Text>
          <Text style={styles.logoSub}>{livroSelecionado?.title} • {programa.title}</Text>

          <View style={styles.resultCard}>
            <Text style={styles.rankLabel}>{nome || "PLAYER01"}</Text>
            <Text style={styles.score}>{pontos} XP</Text>
            <Text style={styles.descriptionCenter}>Máximo possível: {maximo} pontos</Text>
            <Text style={styles.senha}>SENHA DESAFIO: PB-{senha}</Text>
          </View>

          <TouchableOpacity style={styles.mainButton} onPress={() => iniciarPrograma(programa)}>
            <Text style={styles.mainButtonText}>JOGAR NOVAMENTE ›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("ranking")}>
            <Text style={styles.secondaryButtonText}>VER RANKING LOCAL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={voltarInicio}>
            <Text style={styles.secondaryButtonText}>ESCOLHER OUTRO LIVRO</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const atual = perguntasQuiz[indice];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.quizScroll}>
        <View style={styles.quizHeader}>
          <View>
            <Text style={styles.logoSmall}>⚡ PENSE BEM</Text>
            <Text style={styles.programText}>{livroSelecionado?.title} • {programa.title}</Text>
          </View>
          <View style={styles.counterBox}>
            <Text style={styles.counterText}>{indice + 1}/{perguntasQuiz.length}</Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.quizBox,
            {
              transform: [
                {
                  translateX: wrongAnim.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-12, 0, 12],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.tag}>TENTATIVA {tentativa}/3</Text>

          <View style={styles.timerHeader}>
            <Text style={styles.timerLabel}>⏱️ TEMPO RESTANTE</Text>
            <Text style={[styles.timerValue, tempoRestante <= 10 && styles.timerDanger]}>
              {tempoRestante}s
            </Text>
          </View>

          <View style={styles.timerTrack}>
            <View
              style={[
                styles.timerFill,
                { width: `${porcentagemTempo}%` },
                tempoRestante <= 10 && styles.timerFillDanger,
              ]}
            />
          </View>

          <Text style={styles.bonusHint}>
            Bônus: responda em até 10s para ganhar +10 XP
          </Text>

          <Text style={styles.question}>{atual.question}</Text>

          {atual.options.map((opcao, index) => (
            <TouchableOpacity key={index} style={[styles.option, travado && styles.optionDisabled]} disabled={travado} onPress={() => responder(index)}>
              <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text>
              <Text style={styles.optionText}>{opcao}</Text>
            </TouchableOpacity>
          ))}

          {bonusPopup ? (
            <Animated.View
              style={[
                styles.bonusPopup,
                {
                  opacity: bonusAnim,
                  transform: [
                    {
                      scale: bonusAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                    {
                      translateY: bonusAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.bonusPopupText}>{bonusPopup}</Text>
            </Animated.View>
          ) : null}

          <Text style={[styles.message, feedback.includes("ERROU") && styles.messageError]}>{feedback}</Text>
        </Animated.View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Text style={styles.bottomText}>XP: {pontos}</Text>
        <Text style={styles.bottomText}>RANKING LOCAL</Text>
      </View>
    </SafeAreaView>
  );
}

function InfoCard({ number, title, text, icon }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoTop}>
        <Text style={styles.cardNumber}>{number}</Text>
        <Text style={styles.cardIcon}>{icon}</Text>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    minHeight: Platform.OS === "web" ? "100vh" : undefined,
    backgroundColor: "#070711",
  },
  homeScroll: {
    padding: 24,
    paddingBottom: 60,
  },
  quizScroll: {
    padding: 20,
    paddingBottom: 110,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    marginBottom: 24,
  },
  logo: {
    color: "#ffffff",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 1,
  },
  logoSub: {
    color: "#9b35ff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: -2,
  },
  logoSmall: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  profileBox: {
    backgroundColor: "#0f0b1d",
    borderWidth: 1,
    borderColor: "#2f185c",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-end",
  },
  profileName: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },
  profileLevel: {
    color: "#c6ff00",
    fontWeight: "900",
    fontSize: 11,
  },
  hero: {
    borderWidth: 1,
    borderColor: "#7c2cff",
    backgroundColor: "#10091f",
    borderRadius: 22,
    padding: 24,
    marginBottom: 18,
  },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: "#6d28d9",
    color: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 18,
  },
  title: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 43,
  },
  green: {
    color: "#c6ff00",
  },
  description: {
    color: "#c9c4d8",
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 18,
  },
  descriptionCenter: {
    color: "#c9c4d8",
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 10,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#181028",
    borderColor: "#3b1b73",
    borderWidth: 1,
    color: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "700",
  },
  mainButton: {
    backgroundColor: "#c6ff00",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#efff8a",
    marginTop: 10,
    width: "100%",
  },
  mainButtonText: {
    color: "#080711",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#7c2cff",
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 12,
    width: "100%",
  },
  secondaryButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "900",
  },
  rankCard: {
    backgroundColor: "#0f0b1d",
    borderColor: "#3b1b73",
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  trophy: {
    fontSize: 36,
  },
  rankLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  rankNumber: {
    color: "#c6ff00",
    fontSize: 30,
    fontWeight: "900",
  },
  rankLink: {
    color: "#a855f7",
    fontWeight: "900",
    fontSize: 12,
  },
  sectionTitle: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 18,
    marginTop: 8,
  },
  stepsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: "#0f0b1d",
    borderColor: "#6d28d9",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  infoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardNumber: {
    color: "#8b5cf6",
    fontSize: 26,
    fontWeight: "900",
  },
  cardIcon: {
    color: "#9b35ff",
    fontSize: 25,
    fontWeight: "900",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
  },
  cardText: {
    color: "#b8b3c7",
    marginTop: 6,
  },

  bookCard: {
    backgroundColor: "#0f0b1d",
    borderColor: "#c6ff00",
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  bookIcon: {
    fontSize: 42,
  },
  bookInfo: {
    flex: 1,
  },
  programCard: {
    backgroundColor: "#0f0b1d",
    borderColor: "#6d28d9",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  programTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    maxWidth: 280,
  },
  programText: {
    color: "#b8b3c7",
    fontSize: 12,
    marginTop: 4,
  },
  programArrow: {
    color: "#c6ff00",
    fontSize: 34,
    fontWeight: "900",
  },
  quizHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  counterBox: {
    borderWidth: 1,
    borderColor: "#7c2cff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#10091f",
  },
  counterText: {
    color: "#c6ff00",
    fontSize: 16,
    fontWeight: "900",
  },
  quizBox: {
    padding: 22,
    borderRadius: 22,
    backgroundColor: "#10091f",
    borderWidth: 1,
    borderColor: "#6d28d9",
  },
  question: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 24,
    lineHeight: 31,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181028",
    borderWidth: 1,
    borderColor: "#3b1b73",
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
  },
  optionLetter: {
    backgroundColor: "#6d28d9",
    color: "#ffffff",
    width: 32,
    height: 32,
    textAlign: "center",
    lineHeight: 32,
    borderRadius: 8,
    fontWeight: "900",
    marginRight: 12,
    overflow: "hidden",
  },
  optionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  timerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: -6,
    marginBottom: 8,
  },
  timerLabel: {
    color: "#b8b3c7",
    fontSize: 12,
    fontWeight: "900",
  },
  timerValue: {
    color: "#c6ff00",
    fontSize: 18,
    fontWeight: "900",
  },
  timerDanger: {
    color: "#ff4d6d",
  },
  timerTrack: {
    height: 14,
    backgroundColor: "#181028",
    borderWidth: 1,
    borderColor: "#3b1b73",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  timerFill: {
    height: "100%",
    backgroundColor: "#c6ff00",
    borderRadius: 999,
  },
  timerFillDanger: {
    backgroundColor: "#ff4d6d",
  },
  bonusHint: {
    color: "#8f83aa",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 20,
  },
  optionDisabled: {
    opacity: 0.65,
  },
  bonusPopup: {
    alignSelf: "center",
    backgroundColor: "#c6ff00",
    borderColor: "#efff8a",
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 8,
  },
  bonusPopupText: {
    color: "#080711",
    fontSize: 18,
    fontWeight: "900",
  },
  message: {
    color: "#c6ff00",
    textAlign: "center",
    marginTop: 14,
    fontSize: 16,
    fontWeight: "900",
    minHeight: 22,
  },
  messageError: {
    color: "#ff4d6d",
  },
  bottomBar: {
    position: "absolute",
    bottom: 18,
    left: 20,
    right: 20,
    backgroundColor: "#10091f",
    borderWidth: 1,
    borderColor: "#6d28d9",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bottomText: {
    color: "#c6ff00",
    fontWeight: "900",
  },
  centerScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  resultCard: {
    backgroundColor: "#10091f",
    borderWidth: 1,
    borderColor: "#6d28d9",
    borderRadius: 22,
    padding: 28,
    marginVertical: 26,
    alignItems: "center",
    width: "100%",
  },
  score: {
    color: "#c6ff00",
    fontSize: 54,
    fontWeight: "900",
    marginTop: 10,
  },
  senha: {
    color: "#fff",
    backgroundColor: "#181028",
    borderColor: "#3b1b73",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 14,
  },
  rankingItem: {
    backgroundColor: "#0f0b1d",
    borderColor: "#6d28d9",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rankingPosition: {
    color: "#c6ff00",
    fontSize: 22,
    fontWeight: "900",
    width: 44,
  },
  rankingInfo: {
    flex: 1,
  },
  rankingName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  rankingDate: {
    color: "#b8b3c7",
    fontSize: 12,
    marginTop: 4,
  },
  rankingPoints: {
    color: "#c6ff00",
    fontSize: 16,
    fontWeight: "900",
  },
});
