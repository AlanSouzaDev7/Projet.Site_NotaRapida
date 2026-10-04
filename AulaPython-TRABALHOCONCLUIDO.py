nome=input("Digite o seu Nome")
n1=float(input("Primeira Nota B1: ")) 
n2=float(input("Segunda Nota B2: "))
n3=float(input("Segunda Nota B3: "))
n4=float(input("Segunda Nota B4: "))
print(f"As notas do aluno {nome} é a soma entre {n1} e {n2} e {n3} e {n4}, com a media final é {(n1+n2+n3+n4)/4}")
media_final = (n1+n2+n3+n4)/4

match media_final:
    case media_final if media_final >= 6:
        print(f"Parabéns {nome}, você foi aprovado com a média final de {media_final}, voce está na média")
    case media_final if media_final < 6:
        print(f"Infelizmente {nome}, você foi reprovado com a média final de {media_final}")
    case media_final if media_final >= 8:
        print(f"Parabéns {nome}, você foi aprovado com a média final de {media_final}, você está acima da média")
    case media_final if media_final >= 9:
        print(f"Parabéns {nome}, você foi aprovado com a média final de {media_final}, você é um genio")
    case _:
        print(f"Valor inválido para a média final de {media_final}")
