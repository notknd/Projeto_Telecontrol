from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = Path("output/pdf/resumo-arquitetura-e-api-smartpick.pdf")


class FlowDiagram(Flowable):
    def __init__(self):
        super().__init__()
        self.width = 16.5 * cm
        self.height = 3.3 * cm

    def draw(self):
        canvas = self.canv
        labels = [(0, "Frontend\nVue 3"), (5.8, "API principal\nNode + Fastify"), (11.6, "Motor de rotas\nPython + FastAPI")]
        for x, label in labels:
            canvas.setFillColor(colors.HexColor("#16324F"))
            canvas.roundRect(x * cm, 1.5 * cm, 4.5 * cm, 1.1 * cm, 8, fill=1, stroke=0)
            canvas.setFillColor(colors.white)
            canvas.setFont("Helvetica-Bold", 10)
            for index, line in enumerate(label.split("\n")):
                canvas.drawCentredString((x + 2.25) * cm, (2.18 - index * 0.38) * cm, line)
        canvas.setStrokeColor(colors.HexColor("#E67E22"))
        canvas.setLineWidth(2)
        canvas.line(4.65 * cm, 2.05 * cm, 5.55 * cm, 2.05 * cm)
        canvas.line(10.45 * cm, 2.05 * cm, 11.35 * cm, 2.05 * cm)
        canvas.setFillColor(colors.HexColor("#E67E22"))
        canvas.setFont("Helvetica", 9)
        canvas.drawCentredString(8.25 * cm, 0.8 * cm, "A API tambem acessa PostgreSQL para persistir dados do dominio.")


def paragraph(text, style):
    return Paragraph(text, style)


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        topMargin=1.6 * cm, bottomMargin=1.6 * cm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="TitleCustom", parent=styles["Title"], fontName="Helvetica-Bold",
        fontSize=22, leading=27, textColor=colors.HexColor("#16324F"), spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="Subtitle", parent=styles["Normal"], fontSize=10.5, leading=14,
        textColor=colors.HexColor("#566573"), spaceAfter=16,
    ))
    styles.add(ParagraphStyle(
        name="HeadingCustom", parent=styles["Heading2"], fontName="Helvetica-Bold",
        fontSize=14, leading=18, textColor=colors.HexColor("#16324F"), spaceBefore=11, spaceAfter=7,
    ))
    styles.add(ParagraphStyle(
        name="BodyCustom", parent=styles["BodyText"], fontSize=10.3, leading=14.5,
        spaceAfter=7,
    ))
    styles.add(ParagraphStyle(
        name="Small", parent=styles["BodyText"], fontSize=9.3, leading=12.5,
    ))
    styles.add(ParagraphStyle(
        name="DiagramCaption", parent=styles["BodyText"], fontSize=9.5, leading=12,
        alignment=TA_CENTER, textColor=colors.HexColor("#566573"), spaceAfter=8,
    ))

    body = styles["BodyCustom"]
    story = [
        paragraph("SmartPick - Arquitetura e API atual", styles["TitleCustom"]),
        paragraph("Resumo para apresentação do projeto Telecontrol", styles["Subtitle"]),
        paragraph("1. Visão geral da arquitetura", styles["HeadingCustom"]),
        paragraph(
            "O SmartPick é separado em quatro responsabilidades: interface, regras de negócio, "
            "algoritmos de rota e persistência. A separação evita que a tela, o banco e os "
            "cálculos fiquem misturados no mesmo lugar.", body),
        FlowDiagram(),
        paragraph("Fluxo técnico esperado: frontend -> API -> motor de rotas; API -> PostgreSQL.", styles["DiagramCaption"]),
    ]

    rows = [
        [paragraph("<b>Componente</b>", styles["Small"]), paragraph("<b>Função</b>", styles["Small"]), paragraph("<b>Tecnologia</b>", styles["Small"])],
        [paragraph("Frontend", styles["Small"]), paragraph("Exibe telas e envia ações do usuário somente para a API pública.", styles["Small"]), paragraph("Vue 3 + Vite", styles["Small"])],
        [paragraph("API principal", styles["Small"]), paragraph("Centraliza validações, regras de negócio, integração com banco e comunicação com o motor.", styles["Small"]), paragraph("Node.js + Fastify", styles["Small"])],
        [paragraph("Motor de rotas", styles["Small"]), paragraph("Representa o armazém como grafo e calcula caminhos e rotas.", styles["Small"]), paragraph("Python + FastAPI", styles["Small"])],
        [paragraph("Banco", styles["Small"]), paragraph("Mantém produtos, pedidos, posições, rotas e histórico como fonte oficial dos dados.", styles["Small"]), paragraph("PostgreSQL", styles["Small"])],
    ]
    table = Table(rows, colWidths=[3.1 * cm, 8.9 * cm, 3.3 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16324F")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D5DBDB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9F9")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([table, Spacer(1, 8 * 1), paragraph("2. Por que essa divisão?", styles["HeadingCustom"]),
        paragraph("O Vue fica responsável pela experiência visual. O Fastify é o ponto de controle das regras e dados. Python foi escolhido para concentrar os algoritmos de grafo, como Dijkstra e ordenação de paradas. PostgreSQL mantém os registros persistentes e relacionamentos consistentes.", body),
        paragraph("Assim, o navegador não inventa caminhos no armazém; o motor não acessa o banco diretamente; e a API decide o que é válido antes de persistir ou retornar uma rota.", body),
        paragraph("3. Fluxo que o MVP deverá executar", styles["HeadingCustom"]),
        paragraph("1. O usuário cria um pedido no frontend.<br/>2. O frontend envia o pedido à API.<br/>3. A API consulta produtos e posições no PostgreSQL.<br/>4. A API monta um grafo validado e chama o motor Python.<br/>5. O motor devolve a rota calculada.<br/>6. A API valida, salva o resultado e o frontend mostra a sequência de coleta.", body),
        paragraph("4. Como está a API hoje", styles["HeadingCustom"]),
        paragraph("Há dois serviços HTTP ativos, porém ainda não existe a integração completa entre eles.", body),
    ])
    api_rows = [
        [paragraph("<b>Serviço</b>", styles["Small"]), paragraph("<b>Endereço / endpoint</b>", styles["Small"]), paragraph("<b>Estado atual</b>", styles["Small"])],
        [paragraph("API principal", styles["Small"]), paragraph("GET http://127.0.0.1:3000/health", styles["Small"]), paragraph("Retorna o status da API Fastify. Ainda não possui CRUD final de produtos, pedidos ou rotas na branch main.", styles["Small"])],
        [paragraph("Motor Python", styles["Small"]), paragraph("GET http://127.0.0.1:8000/health", styles["Small"]), paragraph("Retorna o status do motor FastAPI e mantém os modelos de grafo testados.", styles["Small"])],
        [paragraph("Cadastro temporário", styles["Small"]), paragraph("POST http://127.0.0.1:8000/api/v1/products", styles["Small"]), paragraph("Cadastra produto com SKU, nome, quantidade, localização, peso e categoria. Grava provisoriamente em JSON local.", styles["Small"])],
    ]
    api_table = Table(api_rows, colWidths=[3.0 * cm, 5.2 * cm, 7.1 * cm])
    api_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16324F")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D5DBDB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9F9")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([api_table, paragraph("O cadastro temporário valida campos obrigatórios, impede quantidade e peso negativos, normaliza o SKU para maiúsculas e não aceita SKU repetido. Ele é uma solução transitória: a versão final deve ficar na API Node e persistir pelo Prisma no PostgreSQL.", body),
        paragraph("5. O que já pode ser demonstrado", styles["HeadingCustom"]),
        paragraph("Os três serviços sobem localmente; os endpoints de saúde respondem; o frontend base abre; o cadastro temporário funciona; e a suíte local passou: API, motor e frontend foram compilados e testados. Ainda não é possível demonstrar o fluxo completo de pedido, rota, mapa, coleta e histórico.", body),
        paragraph("6. Próximas etapas", styles["HeadingCustom"]),
        paragraph("Validar e integrar Prisma/PostgreSQL, mover o cadastro de produtos para a API principal, implementar pedidos, finalizar Dijkstra e a ordenação de paradas, integrar API e motor, e então construir mapa, coleta e histórico no frontend.", body),
    ])
    doc.build(story)


if __name__ == "__main__":
    build_pdf()
