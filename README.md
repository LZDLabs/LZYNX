# LZYNX

**Uma linguagem de programação simples, criada pela LZD Labs.**

LZYNX está em desenvolvimento. Esta é a primeira versão experimental do interpretador, escrita em TypeScript.

## Requisitos

- Node.js 20 ou superior
- npm

## Instalar e executar

```bash
git clone https://github.com/LZDLabs/LZYNX.git
cd LZYNX
npm install
npm run dev -- examples/hello.lzn
```

## Primeiro programa

Crie um arquivo `hello.lzn`:

```lzn
say("Hello, LZYNX!")

name = "Luiz"
say(name)

result = 10 + 5
say(result)
```

Execute:

```bash
npm run dev -- hello.lzn
```

## O que existe na versão 0.1.0

- `say(...)` para mostrar valores no terminal.
- Variáveis com atribuição usando `=`.
- Números e textos.
- Operações matemáticas: `+`, `-`, `*` e `/`.
- Concatenação de texto com `+`.
- Mensagens de erro com linha e coluna.

## Próximas etapas

1. Condicionais e repetições.
2. Funções definidas pelo usuário.
3. CLI `lzn` e LZYNX Studio.
4. Bibliotecas e APIs.
5. Interfaces, aplicações e recursos de IA.

A linguagem ainda não possui esses recursos futuros. Eles serão implementados gradualmente.

---

Made with 💜 by **LZD Labs**.
