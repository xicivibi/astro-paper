let S=Csv.Document(File.Contents("{{SOURCE_CSV}}"),[Delimiter=",",Encoding=65001,QuoteStyle=QuoteStyle.Csv]) in Table.PromoteHeaders(S,[PromoteAllScalars=true])
