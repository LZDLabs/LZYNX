# LZYNX

**Uma linguagem de programação simples, criada pela LZD Labs.**

LZYNX está em desenvolvimento. A versão 0.2.0 traz uma CLI executável chamada `lzn`, além do interpretador em TypeScript.

## Requisitos

- Node.js 20 ou superior
- npm

## Instalação no ambiente de desenvolvimento

```bash
git clone https://github.com/LZDLabs/LZYNX.git
cd LZYNX
npm install
npm run build
npm link
```

Depois da instalação, o comando `lzn` fica disponível no terminal.

## Executar um programa

```bash
lzn run examples/hello.lzn
```

Também é possível executar diretamente um arquivo:

```bash
lzn examples/hello.lzn
```

## Primeiro programa

```lzn
say("Hello, LZYNX!")

name = "Luiz"
say(name)

result = 10 + 5
say(result)
```

## Comandos

- `lzn run <arquivo.lzn>` executa um programa.
- `lzn --version` mostra a versão.
- `lzn --help` mostra a ajuda.

## Recursos atuais

- `say(...)` para mostrar valores no terminal.
- Variáveis com atribuição usando `=`.
- Números e textos.
- Operações matemáticas: `+`, `-`, `*` e `/`.
- Concatenação de texto com `+`.
- Mensagens de erro com linha e coluna.

## Próximas etapas

1. Condicionais e comparações.
2. Repetições e funções.
3. LZYNX Studio.
4. Bibliotecas, APIs e módulos.
5. Interfaces, aplicações e recursos de IA.

A linguagem ainda não possui esses recursos futuros. Eles serão implementados gradualmente.

---

Made with 💜 by **LZD Labs**.
